import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai"
import { z } from "zod"
import { buildSystemPrompt } from "@/lib/agents/prompts"
import { isValidAgentId } from "@/lib/agents/registry"
import { resolveLanguageModel, wireProviderSchema } from "@/lib/ai/resolve-model"

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

  const result = streamText({
    model: resolveLanguageModel(provider),
    instructions: system,
    messages: await convertToModelMessages(messages),
    onError: ({ error }) => {
      console.error("[chat] stream error:", error)
    },
  })

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      onError: (error) =>
        error instanceof Error ? error.message : "The provider returned an error. Check your API key and model.",
    }),
  })
}
