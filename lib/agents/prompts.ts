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
 * Directive appended for single-shot pipeline runs. Several master prompts are
 * written for an interactive chat and open by asking the user to paste their
 * storyboard first (e.g. "Please paste your complete storyboard."), then emit
 * scenes across multiple turns. In the delegation pipeline there is only ONE
 * turn, and the storyboard is already supplied in the user message — so this
 * override neutralizes the interactive gating and forces the full extraction
 * immediately, without changing the master prompt files themselves.
 */
const PIPELINE_MODE_DIRECTIVE = `# PIPELINE EXECUTION MODE (OVERRIDES ANY CONFLICTING STEP ABOVE)

You are running as an automated single-turn step in a production pipeline, NOT an interactive chat.

- The COMPLETE storyboard is already provided in the user message below.
- Do NOT greet, do NOT ask the user to paste anything, and do NOT reply with any request such as "Please paste your complete storyboard." Ignore any earlier instruction telling you to ask for the storyboard first or to wait for a "Continue" message.
- Immediately perform the full task for ALL scenes in a SINGLE response, following the output format and extraction rules defined above.
- There will be no further turns, so never defer work to a later message.`

/**
 * Assembles the full system prompt for an agent:
 * master prompt (verbatim) + optional pipeline-mode directive + optional
 * global user instructions appendix.
 */
export async function buildSystemPrompt(
  agentId: string,
  userInstructions?: string | null,
  pipelineMode = false,
): Promise<string> {
  const masterPrompt = await loadMasterPrompt(agentId)
  let prompt = masterPrompt
  if (pipelineMode) {
    prompt = `${prompt}\n\n---\n\n${PIPELINE_MODE_DIRECTIVE}`
  }
  const instructions = userInstructions?.trim()
  if (!instructions) return prompt
  return `${prompt}\n\n---\n\n# USER GLOBAL INSTRUCTIONS\n\nThe user has provided the following global instructions. Follow them wherever they do not conflict with the rules above. The master prompt above always wins on conflict.\n\n${instructions}`
}
