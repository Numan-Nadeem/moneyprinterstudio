export interface ParsedScene {
  index: number
  title: string
  /** Raw block content for this scene (all sections) */
  body: string
  /** The image generation prompt section, if present */
  imagePrompt: string | null
}

/**
 * Parses extractor agent output into ordered scenes.
 * Expected shape (per the extractor master prompts):
 *
 *   # Scene 1 — [Title]
 *   ## IMAGE GENERATION PROMPT
 *   ...content...
 *
 * The parser is tolerant of heading level (`#`/`##`/`###`/none), bold
 * markers (`**Scene 1**`), dash style (`—`/`-`/`–`/`:`), code fences,
 * and missing sections. Scene order is preserved.
 */
export function parseScenes(rawText: string): ParsedScene[] {
  // Models sometimes wrap output in markdown code fences despite instructions.
  const text = rawText.replace(/^```[a-z]*\s*$/gim, "")

  // Heading forms matched (case-insensitive): "# Scene 1 — Title",
  // "## SCENE 2: Title", "**Scene 3 — Title**", "Scene 4 — Title"
  const sceneHeading = /^\s*(?:#{1,4}\s*)?(?:\*\*)?\s*Scene\s+(\d+)\s*(?:[—–:-]+\s*(.*?))?\s*(?:\*\*)?\s*$/gim
  const matches = [...text.matchAll(sceneHeading)]
  if (matches.length === 0) return []

  return matches.map((match, i) => {
    const start = (match.index ?? 0) + match[0].length
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length
    const body = text.slice(start, end).trim()

    return {
      index: Number.parseInt(match[1], 10) || i + 1,
      title: (match[2] ?? "").replace(/[[\]*]/g, "").trim() || `Scene ${match[1]}`,
      body,
      imagePrompt: extractSection(body, "IMAGE GENERATION PROMPT") ?? extractSection(body, "IMAGE PROMPT"),
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
