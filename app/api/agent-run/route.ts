import { generateText } from "ai"
import { getAgent } from "@/lib/agents/registry"
import { buildSystemPrompt } from "@/lib/agents/prompts"
import {
  resolveLanguageModelCandidates,
  wireProviderSchema,
  type WireProviderConfig,
} from "@/lib/ai/resolve-model"
import { explainProviderError } from "@/lib/ai/provider-errors"

export const maxDuration = 300

interface AgentRunBody {
  agentId: string
  input: string
  provider: WireProviderConfig
  instructions?: string
  /** when true, append the pipeline-mode directive that disables interactive gating */
  pipeline?: boolean
}

/**
 * Non-streaming single-shot agent run used by the pipeline engine.
 * Loads the agent's master prompt verbatim as the system prompt and
 * returns the full completion.
 */
export async function POST(req: Request) {
  let body: AgentRunBody
  try {
    body = (await req.json()) as AgentRunBody
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  }

  const agent = getAgent(body.agentId)
  if (!agent) {
    return Response.json({ error: `Unknown agent: ${body.agentId}` }, { status: 404 })
  }
  if (!body.input?.trim()) {
    return Response.json({ error: "Input is required" }, { status: 400 })
  }
  const providerParsed = wireProviderSchema.safeParse(body.provider)
  if (!providerParsed.success) {
    return Response.json({ error: "Provider configuration is incomplete" }, { status: 400 })
  }
  body.provider = providerParsed.data

  let system: string
  try {
    system = await buildSystemPrompt(agent.id, body.instructions, body.pipeline === true)
  } catch {
    return Response.json({ error: `Master prompt not found for ${agent.id}` }, { status: 500 })
  }

  // Custom OpenAI-compatible proxies may serve a given model only through
  // one endpoint format (Chat Completions vs Responses API) — try each.
  const candidates = resolveLanguageModelCandidates(body.provider)
  let lastError: unknown = null

  for (const model of candidates) {
    try {
      const result = await generateText({
        model,
        system,
        prompt: body.input,
        maxRetries: 1,
        // Multi-scene extractions (video prompts, metadata) can easily run
        // to several thousand tokens. Without an explicit cap, providers
        // fall back to a low default and silently truncate mid-response —
        // producing scenes with headers but missing content.
        maxOutputTokens: 16000,
      })
      if (result.finishReason === "length") {
        console.error(`[agent-run] ${body.agentId} output was truncated at the token limit`)
        return Response.json({
          text: result.text,
          warning:
            "The response was cut off before finishing — some scenes near the end may be missing content. Try running the pipeline on fewer scenes at a time, or use a model with a larger output limit.",
        })
      }
      return Response.json({ text: result.text })
    } catch (error) {
      lastError = error
      console.error("[agent-run] format attempt failed:", error)
    }
  }

  return Response.json(
    { error: explainProviderError(lastError, body.provider.model) },
    { status: 502 },
  )
}
