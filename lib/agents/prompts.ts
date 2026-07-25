import "server-only"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { getAgent } from "./registry"

const cache = new Map<string, string>()

/**
 * Loads an agent's master prompt verbatim from its markdown file at the
 * repository root. Master prompts are the source of truth for agent behavior
 * and must never be mutated, summarized, or "improved" (see docs/Rules.md).
 */
export async function loadMasterPrompt(agentId: string): Promise<string> {
  const agent = getAgent(agentId)
  if (!agent) {
    throw new Error(`Unknown agent: ${agentId}`)
  }
  const cached = cache.get(agent.promptFile)
  if (cached) return cached

  const filePath = path.join(process.cwd(), agent.promptFile)
  const content = await readFile(filePath, "utf-8")
  cache.set(agent.promptFile, content)
  return content
}

/**
 * Assembles the full system prompt for an agent:
 * master prompt (verbatim) + optional global user instructions appendix.
 */
export async function buildSystemPrompt(
  agentId: string,
  userInstructions?: string | null,
): Promise<string> {
  const masterPrompt = await loadMasterPrompt(agentId)
  const instructions = userInstructions?.trim()
  if (!instructions) return masterPrompt
  return `${masterPrompt}\n\n---\n\n# USER GLOBAL INSTRUCTIONS\n\nThe user has provided the following global instructions. Follow them wherever they do not conflict with the rules above. The master prompt above always wins on conflict.\n\n${instructions}`
}
