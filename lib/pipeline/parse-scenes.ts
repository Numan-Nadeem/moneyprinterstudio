export interface ParsedScene {
  index: number
  title: string
  /** Raw block content for this scene (all sections) */
  body: string
  /** The image generation prompt section, if present */
  imagePrompt: string | null
}

/**
 * Parses extractor agent output (or a raw storyboard) into ordered scenes.
 *
 * Supported heading formats (case-insensitive, any language):
 *   # Scene 1 — Title          (markdown heading + em-dash)
 *   ## SCENE 2: Title           (colon separator)
 *   **Scene 3 — Title**         (bold marker)
 *   Scene 4 — Title             (bare, no heading marker)
 *   🎬 SCENE 1 HOOK             (emoji prefix, space-separated subtitle)
 *   🎬 Scene 2 (3–10 sec)       (emoji + parenthetical)
 *   SCENE 5 TWIST               (all-caps, subtitle after space)
 *
 * The parser is tolerant of heading level, bold markers, dash style,
 * emoji prefixes, code fences, and missing sections. Scene order is preserved.
 */
export function parseScenes(rawText: string): ParsedScene[] {
  // Models sometimes wrap output in markdown code fences despite instructions.
  const text = rawText.replace(/^```[a-z]*\s*$/gim, "")

  // Strip any leading emoji + optional whitespace from a line before matching.
  // Then match: optional markdown heading markers, optional bold markers,
  // the word "Scene"/"SCENE", a scene number, then an optional title portion
  // which may be separated by —/–/-/: or just a space.
  //
  // Capture groups:
  //   1 — scene number
  //   2 — title text (after separator), may be empty
  const sceneHeading =
    /^\s*[\p{Emoji}\p{Emoji_Component}]*\s*(?:#{1,4}\s*)?(?:\*\*)?\s*Scene\s+(\d+)\s*(?:[—–:\-]+\s*(.*?)|(\S[^*\n]*)?)?\s*(?:\*\*)?\s*$/gimu

  const matches = [...text.matchAll(sceneHeading)]
  if (matches.length === 0) return []

  return matches.map((match, i) => {
    const start = (match.index ?? 0) + match[0].length
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length
    const body = text.slice(start, end).trim()

    // Group 2 catches dash-separated titles; group 3 catches space-separated ones.
    const rawTitle = (match[2] ?? match[3] ?? "").replace(/[[\]*]/g, "").trim()
    const title = rawTitle || `Scene ${match[1]}`

    return {
      index: Number.parseInt(match[1], 10) || i + 1,
      title,
      body,
      imagePrompt:
        extractSection(body, "IMAGE GENERATION PROMPT") ??
        extractSection(body, "IMAGE PROMPT") ??
        extractSection(body, "Image Prompt") ??
        extractSection(body, "Video Prompt"),
    }
  })
}

/**
 * Extracts a named `## SECTION` block from a scene body, preserving
 * the content exactly as written until the next heading or separator.
 */
export function extractSection(body: string, section: string): string | null {
  // Matches "## SECTION", "### Section:", "**SECTION**", with optional colon
  const heading = new RegExp(
    `^(?:#{2,4}\\s*|\\*\\*)\\s*${escapeRegExp(section)}\\s*:?\\s*(?:\\*\\*)?\\s*$`,
    "im",
  )
  const match = heading.exec(body)
  if (!match) return null

  const start = match.index + match[0].length
  // Content runs until the next heading or horizontal rule
  const rest = body.slice(start)
  const next = /^(#{1,4}\s|---\s*$)/m.exec(rest)
  const content = (next ? rest.slice(0, next.index) : rest).trim()
  return content || null
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export interface ExtractedScene {
  title: string
  imagePrompt: string
}

/**
 * Robustly extracts a JSON array of `{ title, imagePrompt }` scenes from a
 * model response. Tolerates surrounding prose and code fences by isolating
 * the outermost `[ ... ]` span before parsing. Returns [] on any failure so
 * callers can fall back to heading-based parsing.
 */
export function parseSceneJson(raw: string): ExtractedScene[] {
  if (!raw) return []
  const text = raw.replace(/```(?:json)?/gi, "").trim()
  const start = text.indexOf("[")
  const end = text.lastIndexOf("]")
  if (start === -1 || end === -1 || end <= start) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(text.slice(start, end + 1))
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  return parsed
    .map((item) => {
      const record = (item ?? {}) as Record<string, unknown>
      const prompt = record.imagePrompt ?? record.prompt ?? record.image_prompt
      return {
        title: typeof record.title === "string" ? record.title.trim() : "",
        imagePrompt: typeof prompt === "string" ? prompt.trim() : "",
      }
    })
    .filter((s) => s.imagePrompt.length > 0)
    .map((s, i) => ({ title: s.title || `Scene ${i + 1}`, imagePrompt: s.imagePrompt }))
}
