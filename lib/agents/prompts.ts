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
 * Removes interactive "greet first / wait for the storyboard" gating from a
 * master prompt so it can run as a single automated turn.
 *
 * Some master prompts open with an absolute rule like:
 *   ## STEP 1
 *   When this conversation starts, ask ONLY:
 *   **"Please paste your complete storyboard."**
 * which is strong enough that the model re-issues the greeting even when the
 * storyboard is already supplied and a "pipeline mode" directive is appended.
 * The only reliable fix is to delete the instruction itself before the model
 * ever sees it. Operates on the in-memory copy only — the master prompt files
 * on disk (the source of truth) are never modified.
 */
function stripInteractiveGating(prompt: string): string {
  return (
    prompt
      // Drop a leading "## STEP 1 ... " greeting block up to its trailing rule.
      .replace(/^#{1,3}\s*STEP\s*1\b[\s\S]*?(?:\n-{3,}\s*\n|\n-{3,}\s*$)/im, (block) =>
        /paste|ask only|conversation starts/i.test(block) ? "" : block,
      )
      // Neutralize any remaining "ask the user to paste the storyboard" lines.
      .replace(/^.*please paste your complete storyboard.*$/gim, "")
      // Neutralize "wait for me to type Continue" style turn-gating.
      .replace(/^.*\btype\s+continue\b.*$/gim, "")
      .replace(/^.*\bwait for (?:me|the user) to (?:type|say|paste).*$/gim, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  )
}

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
    prompt = `${stripInteractiveGating(prompt)}\n\n---\n\n${PIPELINE_MODE_DIRECTIVE}`
  }
  const instructions = userInstructions?.trim()
  if (!instructions) return prompt
  return `${prompt}\n\n---\n\n# USER GLOBAL INSTRUCTIONS\n\nThe user has provided the following global instructions. Follow them wherever they do not conflict with the rules above. The master prompt above always wins on conflict.\n\n${instructions}`
}
