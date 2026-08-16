/**
 * Strips common markdown symbols from plain-text output so scene cards
 * don't display raw `##`, `**`, `---`, `*` etc.
 */
export function stripMarkdown(text: string): string {
  return (
    text
      // Remove heading markers (# ## ###)
      .replace(/^#{1,6}\s+/gm, "")
      // Remove bold/italic (**text**, *text*, __text__, _text_)
      .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, "$2")
      // Remove horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, "")
      // Remove blockquote markers
      .replace(/^>\s?/gm, "")
      // Collapse 3+ blank lines into 2
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  )
}

export interface SceneChunk {
  label: string
  body: string
}

/**
 * Splits a multi-scene text block on scene headings so each scene gets its
 * own card with a dedicated copy button.
 * Handles any heading format: "Scene 1", "## Scene 1 — HOOK", "SCENE 1:",
 * "🎬 SCENE 1 HOOK", "SCENE 1 / 7 — TITLE", etc.
 * Falls back to a single block when no scene structure is detected.
 */
export function splitIntoScenes(text: string): SceneChunk[] {
  // Split the text on every line that starts a new scene heading.
  // We use a simple line-by-line approach instead of regex lookahead so it
  // works reliably across any LLM output format.
  const lines = text.split("\n")
  // Matches any scene heading regardless of emoji prefix, markdown markers, or
  // separator style: "🎬 SCENE 1 HOOK", "# Scene 2 — Title", "Scene 3:", etc.
  const sceneHeadingRe =
    /^[\p{Emoji}\p{Emoji_Component}]*\s*(?:#{1,6}\s*)?(?:\*\*)?\s*(?:scene|szene|escena|scène)\s+\d+/iu

  const chunks: { label: string; lines: string[] }[] = []

  for (const line of lines) {
    // Strip leading emoji, markdown heading markers, and bold markers for display
    const clean = line
      .replace(/^[\p{Emoji}\p{Emoji_Component}]+\s*/u, "")
      .replace(/^#{1,6}\s*/, "")
      .replace(/^\*\*|\*\*$/g, "")
      .trim()
    if (sceneHeadingRe.test(line.trim())) {
      // Normalize dash-style separators for display, keeping subtitle words
      const label = clean.replace(/\s*[—–]{1,}\s*/g, " — ").trim()
      chunks.push({ label, lines: [line] })
    } else if (chunks.length > 0) {
      chunks[chunks.length - 1].lines.push(line)
    }
    // lines before the first scene heading are silently dropped
  }

  if (chunks.length <= 1) {
    // No scene structure detected — return as a single block
    return [{ label: "Output", body: stripMarkdown(text) }]
  }

  return chunks.map((c) => ({
    label: c.label,
    body: stripMarkdown(c.lines.join("\n")),
  }))
}

/** True when the text contains at least two detectable scene headings. */
export function hasMultipleScenes(text: string): boolean {
  return splitIntoScenes(text).length > 1
}
