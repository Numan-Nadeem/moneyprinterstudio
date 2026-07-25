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
import { resolveLanguageModel } from "@/lib/ai/resolve-model"

export const maxDuration = 120

const bodySchema = z.object({
  messages: z.array(z.custom<UIMessage>()),
  agentId: z.string(),
  provider: z.object({
    kind: z.enum(["gateway", "openai", "anthropic", "google"]),
    apiKey: z.string().min(1),
    model: z.string().min(1),
  }),
  instructions: z.string().optional(),
})

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  }
  const { messages, agentId, provider, instructions } = parsed.data

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
