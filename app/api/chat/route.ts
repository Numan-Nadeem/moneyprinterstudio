import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type LanguageModel,
  type ModelMessage,
  type UIMessage,
  type UIMessageChunk,
} from "ai"
import { z } from "zod"
import { buildSystemPrompt } from "@/lib/agents/prompts"
import { isValidAgentId } from "@/lib/agents/registry"
import { resolveLanguageModelCandidates, wireProviderSchema } from "@/lib/ai/resolve-model"
import { explainProviderError } from "@/lib/ai/provider-errors"

export const maxDuration = 120

const bodySchema = z.object({
  messages: z.array(z.custom<UIMessage>()),
  agentId: z.string(),
  provider: wireProviderSchema,
  instructions: z.string().optional(),
})

/**
 * Strips provider-specific state from replayed history. Persisted/restored
 * messages can carry OpenAI Responses item references (e.g. reasoning ids
 * like "rs_...") in their provider metadata; replaying those against a new
 * request fails with "Item with id ... not found" because the items are not
 * stored server-side. Dropping reasoning parts and provider metadata makes
 * every request self-contained.
 */
function sanitizeHistory(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) => ({
    ...message,
    parts: message.parts
      .filter((part) => part.type !== "reasoning")
      .map((part) => {
        const { providerMetadata: _pm, ...rest } = part as typeof part & {
          providerMetadata?: unknown
        }
        return rest as typeof part
      }),
  }))
}

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  }
  const { messages: rawMessages, agentId, provider, instructions } = parsed.data
  const messages = sanitizeHistory(rawMessages)

  if (!isValidAgentId(agentId)) {
    return Response.json({ error: "Unknown agent" }, { status: 404 })
  }

  const system = await buildSystemPrompt(agentId, instructions)
  const modelMessages = await convertToModelMessages(messages)

  // Custom OpenAI-compatible proxies route models to different endpoint
  // formats (Chat Completions vs Responses API). Try each candidate in
  // order; if one fails before producing any content, fall back to the next.
  const candidates = resolveLanguageModelCandidates(provider)

  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: async ({ writer }) => {
        await streamWithFallback(writer, candidates, system, modelMessages, provider.model)
      },
      onError: (error) => explainProviderError(error, provider.model),
    }),
  })
}

async function streamWithFallback(
  writer: { write: (chunk: UIMessageChunk) => void },
  candidates: LanguageModel[],
  system: string,
  modelMessages: ModelMessage[],
  requestedModel: string,
) {
  let lastError: unknown = null

  for (let i = 0; i < candidates.length; i++) {
    const isLast = i === candidates.length - 1
    const result = streamText({
      model: candidates[i],
      instructions: system,
      messages: modelMessages,
      // Multi-scene extractions can run to several thousand tokens; without
      // an explicit cap, providers fall back to a low default and silently
      // cut the response short partway through the storyboard.
      maxOutputTokens: 16000,
      onError: ({ error }) => {
        console.error(`[chat] stream error (format ${i + 1}/${candidates.length}):`, error)
      },
    })

    // Buffer structural chunks until real content arrives; if the stream
    // errors before any content, discard the buffer and try the next format.
    const buffered: UIMessageChunk[] = []
    let contentSeen = false
    let failedBeforeContent = false

    const reader = toUIMessageStream({
      stream: result.stream,
      onError: (error) => {
        lastError = error
        return error instanceof Error ? error.message : "Provider error"
      },
    }).getReader()

    try {
      while (true) {
        const { done, value: chunk } = await reader.read()
        if (done) break
        if (chunk.type === "error" && !contentSeen) {
          failedBeforeContent = true
          break
        }
        if (contentSeen) {
          writer.write(chunk)
          continue
        }
        buffered.push(chunk)
        if (chunk.type !== "start" && chunk.type !== "start-step" && chunk.type !== "error") {
          contentSeen = true
          for (const b of buffered) writer.write(b)
          buffered.length = 0
        }
      }
    } finally {
      reader.releaseLock()
    }

    if (!failedBeforeContent) return
    if (isLast) {
      writer.write({ type: "error", errorText: explainProviderError(lastError, requestedModel) })
    }
  }
}
