import { generateText } from "ai"
import { getAgent } from "@/lib/agents/registry"
import { buildSystemPrompt } from "@/lib/agents/prompts"
import { resolveLanguageModel, type WireProviderConfig } from "@/lib/ai/resolve-model"

export const maxDuration = 300

interface AgentRunBody {
  agentId: string
  input: string
  provider: WireProviderConfig
  instructions?: string
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
  if (!body.provider?.apiKey || !body.provider?.model) {
    return Response.json({ error: "Provider configuration is incomplete" }, { status: 400 })
  }

  let system: string
  try {
    system = await buildSystemPrompt(agent.id, body.instructions)
  } catch {
    return Response.json({ error: `Master prompt not found for ${agent.id}` }, { status: 500 })
  }

  try {
    const model = resolveLanguageModel(body.provider)
    const result = await generateText({
      model,
      system,
      prompt: body.input,
    })
    return Response.json({ text: result.text })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent run failed"
    return Response.json({ error: message }, { status: 502 })
  }
}
