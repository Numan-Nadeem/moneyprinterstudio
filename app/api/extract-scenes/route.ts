import { generateText } from "ai"
import {
  resolveLanguageModelCandidates,
  wireProviderSchema,
  type WireProviderConfig,
} from "@/lib/ai/resolve-model"
import { explainProviderError } from "@/lib/ai/provider-errors"
import { parseSceneJson, parseScenes, type ExtractedScene } from "@/lib/pipeline/parse-scenes"

export const maxDuration = 300

interface ExtractScenesBody {
  storyboard: string
  provider: WireProviderConfig
  instructions?: string
}

/**
 * Format-agnostic scene extraction for the delegation pipeline.
 *
 * Unlike the interactive Image Prompt Extractor agent (which gates on "Type
 * Continue" and emits one scene per turn), this endpoint asks the model to
 * intelligently read a storyboard in ANY format and return every scene's
 * image-generation prompt at once, as structured JSON. It makes no assumptions
 * about headings, numbering, language, or section labels — the model adapts to
 * whatever structure the storyboard happens to use.
 */
const EXTRACTION_SYSTEM = `You are a scene-extraction engine inside a video production pipeline.

You will receive a storyboard in ANY format. It may use markdown headings, numbered lists, emoji, tables, screenplay style, plain prose, or a mix — possibly in any language. Do NOT assume a specific structure or require particular headings.

Your task:
1. Intelligently identify each distinct scene or shot, in their original order. Infer scene boundaries from meaning, not from a fixed heading format.
2. For each scene, produce ONE clean, production-ready IMAGE GENERATION PROMPT describing that scene's visual:
   - If the scene already contains an explicit image/visual prompt, use it and preserve its wording and creative intent.
   - If it does not, synthesize a concise, vivid visual prompt from the scene's description (setting, characters, action, mood, lighting, framing).
   - Apply any global style, quality, or continuity instructions that the storyboard states apply to every scene (e.g. aspect ratio, render style, "continue from the previous shot"). Append such continuity text once, never duplicated.
3. Ignore non-visual material (dialogue, voiceover, SEO, hashtags, sound design, titles) UNLESS it is the only description available for a scene.
4. Do not rewrite the story, shorten prompts, or invent unrelated narrative.

Return ONLY a JSON array — no markdown, no code fences, no commentary — shaped exactly like:
[
  { "title": "<short scene label>", "imagePrompt": "<production-ready image prompt>" }
]

If the input genuinely contains no scenes, return [].`

export async function POST(req: Request) {
  let body: ExtractScenesBody
  try {
    body = (await req.json()) as ExtractScenesBody
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!body.storyboard?.trim()) {
    return Response.json({ error: "Storyboard is required" }, { status: 400 })
  }
  const providerParsed = wireProviderSchema.safeParse(body.provider)
  if (!providerParsed.success) {
    return Response.json({ error: "Provider configuration is incomplete" }, { status: 400 })
  }
  const provider = providerParsed.data

  const instructions = body.instructions?.trim()
  const system = instructions
    ? `${EXTRACTION_SYSTEM}\n\n# ADDITIONAL USER INSTRUCTIONS\n\nFollow these wherever they do not conflict with the rules above.\n\n${instructions}`
    : EXTRACTION_SYSTEM

  const candidates = resolveLanguageModelCandidates(provider)
  let lastError: unknown = null

  for (const model of candidates) {
    try {
      const result = await generateText({
        model,
        system,
        prompt: body.storyboard,
        maxRetries: 1,
        maxOutputTokens: 16000,
      })

      // Prefer structured JSON; fall back to heading-based parsing of the
      // model output, then of the raw storyboard, so a stray non-JSON reply
      // still yields scenes when the content is clearly structured.
      let scenes: ExtractedScene[] = parseSceneJson(result.text)
      if (scenes.length === 0) {
        const byHeading = parseScenes(result.text)
        const source = byHeading.length > 0 ? byHeading : parseScenes(body.storyboard)
        scenes = source.map((s) => ({ title: s.title, imagePrompt: s.imagePrompt ?? s.body }))
      }

      const truncated = result.finishReason === "length"
      return Response.json({
        scenes,
        raw: result.text,
        warning: truncated
          ? "The response was cut off before finishing — some scenes near the end may be missing. Try a model with a larger output limit or split the storyboard."
          : undefined,
      })
    } catch (error) {
      lastError = error
      console.error("[extract-scenes] format attempt failed:", error)
    }
  }

  return Response.json({ error: explainProviderError(lastError, provider.model) }, { status: 502 })
}
