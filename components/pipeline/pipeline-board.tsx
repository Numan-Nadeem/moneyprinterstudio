"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowRightIcon,
  ArrowCounterClockwiseIcon,
  CheckCircleIcon,
  CopyIcon,
  DownloadSimpleIcon,
  SpinnerIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { usePipeline, type PipelineScene } from "@/hooks/use-pipeline"
import { useStudioSettings } from "@/hooks/use-studio-settings"

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a")
  a.href = dataUrl
  a.download = filename
  a.click()
}

const STAGE_LABELS: Record<string, string> = {
  idle: "Paste storyboard",
  extracting: "Extracting image prompts",
  review: "Review scenes",
  generating: "Generating images",
  "awaiting-confirmation": "Awaiting confirmation",
  "video-extraction": "Extracting video prompts",
  "post-processing": "Post processing",
  complete: "Complete",
  error: "Error",
}

export function PipelineBoard() {
  const { state, start, runImages, runVideoStage, retryScene, reset } = usePipeline()
  const { settings } = useStudioSettings()
  const [storyboardInput, setStoryboardInput] = useState("")

  const doneCount = state.scenes.filter((s) => s.status === "done").length
  const allImagesDone = state.scenes.length > 0 && doneCount === state.scenes.length
  const failedScene = state.scenes.findIndex((s) => s.status === "error")

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-2xl tracking-tight text-balance">Delegation Pipeline</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Storyboard in — extracted prompts, scene images, video prompts, and post-processing out.
          </p>
        </div>
        {state.stage !== "idle" && (
          <Button variant="outline" size="sm" onClick={reset}>
            <XIcon className="size-3.5" weight="bold" aria-hidden />
            Reset
          </Button>
        )}
      </header>

      {/* Stage indicator */}
      <div className="flex items-center gap-2" aria-live="polite">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 font-mono text-[11px] tracking-[0.05em] text-secondary-foreground uppercase">
          {(state.stage === "extracting" ||
            state.stage === "generating" ||
            state.stage === "video-extraction" ||
            state.stage === "post-processing") && <SpinnerIcon className="size-3 animate-spin" aria-hidden />}
          {STAGE_LABELS[state.stage]}
        </span>
        {state.scenes.length > 0 && (
          <span className="font-mono text-[11px] text-muted-foreground">
            {doneCount}/{state.scenes.length} scenes
          </span>
        )}
        <span className="font-mono text-[11px] text-muted-foreground">
          · {settings.autoContinue ? "auto-continue" : "confirm each scene"}
        </span>
      </div>

      {state.error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md bg-pastel-red px-4 py-3 text-sm text-pastel-red-foreground"
        >
          <WarningCircleIcon className="mt-0.5 size-4 shrink-0" weight="bold" aria-hidden />
          <span>{state.error}</span>
        </div>
      )}

      {/* Stage: idle — storyboard input */}
      {state.stage === "idle" && (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6">
          <label htmlFor="storyboard" className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
            Complete storyboard
          </label>
          <Textarea
            id="storyboard"
            value={storyboardInput}
            onChange={(e) => setStoryboardInput(e.target.value)}
            placeholder="Paste your complete storyboard from the Storyboard Generator…"
            className="min-h-56 resize-y font-mono text-xs leading-relaxed"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Generate one first with the{" "}
              <Link href="/agents/storyboard-generator" className="underline underline-offset-2">
                Storyboard Generator
              </Link>
              .
            </p>
            <Button onClick={() => start(storyboardInput)} disabled={!storyboardInput.trim()}>
              Start pipeline
              <ArrowRightIcon className="size-4" weight="bold" aria-hidden />
            </Button>
          </div>
        </section>
      )}

      {/* Scenes strip */}
      {state.scenes.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">Scenes</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {state.scenes.map((scene, i) => (
              <SceneCard key={scene.index} scene={scene} position={i} onRetry={() => retryScene(i)} />
            ))}
          </div>

          {/* Confirmation gates */}
          {state.stage === "review" && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4">
              <p className="text-sm text-muted-foreground">
                {state.scenes.length} scenes extracted. Ready to generate images one by one.
              </p>
              <Button onClick={() => runImages(0)}>
                Generate scene 1
                <ArrowRightIcon className="size-4" weight="bold" aria-hidden />
              </Button>
            </div>
          )}

          {state.stage === "awaiting-confirmation" && failedScene === -1 && !allImagesDone && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4">
              <p className="text-sm text-muted-foreground">
                Scene {state.cursor} done. Continue to scene {state.cursor + 1}?
              </p>
              <Button onClick={() => runImages(state.cursor)}>
                Continue
                <ArrowRightIcon className="size-4" weight="bold" aria-hidden />
              </Button>
            </div>
          )}

          {state.stage === "awaiting-confirmation" && allImagesDone && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircleIcon className="size-4 text-pastel-green-foreground" weight="fill" aria-hidden />
                All {state.scenes.length} images generated and saved to the gallery.
              </p>
              <Button onClick={runVideoStage}>
                Extract video prompts
                <ArrowRightIcon className="size-4" weight="bold" aria-hidden />
              </Button>
            </div>
          )}
        </section>
      )}

      {/* Video prompts output — one card per scene */}
      {state.videoPrompts && (
        <PerSceneOutputBlock
          title="Video generation prompts"
          content={state.videoPrompts}
          filename="video-prompts.txt"
          loadingNext={state.stage === "post-processing"}
          loadingLabel="Running video metadata…"
        />
      )}

      {/* Video metadata output */}
      {state.postProcessing && (
        <OutputBlock title="Video metadata" content={state.postProcessing} filename="video-metadata.txt" />
      )}

      {state.stage === "complete" && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircleIcon className="size-4 text-pastel-green-foreground" weight="fill" aria-hidden />
            Pipeline complete. Images are in the gallery; prompts are ready to download.
          </p>
          <Button variant="outline" asChild>
            <Link href="/gallery">Open gallery</Link>
          </Button>
        </div>
      )}
    </div>
  )
}

function SceneCard({
  scene,
  position,
  onRetry,
}: {
  scene: PipelineScene
  position: number
  onRetry: () => void
}) {
  return (
    <figure className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="relative flex aspect-[9/16] items-center justify-center bg-secondary">
        {scene.status === "done" && scene.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={scene.image}
            alt={`Scene ${scene.index}: ${scene.title}`}
            className="absolute inset-0 size-full object-cover"
          />
        ) : scene.status === "generating" ? (
          <SpinnerIcon className="size-5 animate-spin text-muted-foreground" aria-hidden />
        ) : scene.status === "error" ? (
          <div className="flex flex-col items-center gap-2 px-3 text-center">
            <WarningCircleIcon className="size-5 text-pastel-red-foreground" weight="bold" aria-hidden />
            <Button variant="outline" size="sm" onClick={onRetry}>
              <ArrowCounterClockwiseIcon className="size-3" weight="bold" aria-hidden />
              Retry
            </Button>
          </div>
        ) : (
          <span className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">Pending</span>
        )}
        {scene.status === "done" && scene.image && (
          <button
            type="button"
            onClick={() => downloadDataUrl(scene.image!, `scene-${scene.index}.png`)}
            className="absolute right-2 bottom-2 rounded-md bg-background/90 p-1.5 text-foreground transition-colors hover:bg-background"
            aria-label={`Download scene ${scene.index} image`}
          >
            <DownloadSimpleIcon className="size-3.5" weight="bold" aria-hidden />
          </button>
        )}
      </div>
      <figcaption className="flex flex-col gap-0.5 px-3 py-2">
        <span className="font-mono text-[10px] text-muted-foreground">Scene {scene.index}</span>
        <span className="truncate text-xs font-medium" title={scene.title}>
          {scene.title}
        </span>
      </figcaption>
    </figure>
  )
}

/**
 * Strips common markdown symbols from plain-text output so pipeline cards
 * don't display raw `##`, `**`, `---`, `*` etc.
 */
function stripMarkdown(text: string): string {
  return text
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
}

/**
 * Splits a multi-scene text block on scene headings so each scene gets its
 * own card with a dedicated copy button.
 * Handles any heading format: "Scene 1", "## Scene 1 — HOOK", "SCENE 1:", etc.
 * Falls back to a single block when no scene structure is detected.
 */
function splitIntoScenes(text: string): { label: string; body: string }[] {
  // Split the text on every line that starts a new scene heading.
  // We use a simple line-by-line approach instead of regex lookahead so it
  // works reliably across any LLM output format.
  const lines = text.split("\n")
  // Matches any scene heading regardless of emoji prefix, markdown markers, or
  // separator style: "🎬 SCENE 1 HOOK", "# Scene 2 — Title", "Scene 3:", etc.
  const sceneHeadingRe = /^[\p{Emoji}\p{Emoji_Component}]*\s*(?:#{1,6}\s*)?(?:\*\*)?\s*(?:scene|szene|escena|scène)\s+\d+/iu

  const chunks: { label: string; lines: string[] }[] = []

  for (const line of lines) {
    // Strip leading emoji, markdown heading markers, and bold markers for display
    const clean = line.replace(/^[\p{Emoji}\p{Emoji_Component}]+\s*/u, "").replace(/^#{1,6}\s*/, "").replace(/^\*\*|\*\*$/g, "").trim()
    if (sceneHeadingRe.test(line.trim())) {
      // Remove trailing dash-style separators like " — HOOK" → keep "Scene 1 HOOK"
      // but preserve subtitle words after space (e.g. "Scene 1 HOOK" stays intact)
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

function PerSceneOutputBlock({
  title,
  content,
  filename,
  loadingNext,
  loadingLabel,
}: {
  title: string
  content: string
  filename: string
  loadingNext?: boolean
  loadingLabel?: string
}) {
  const scenes = splitIntoScenes(content)
  const [copiedAll, setCopiedAll] = useState(false)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">{title}</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const allScenes = splitIntoScenes(content).map((s) => `${s.label}\n\n${s.body}`).join("\n\n---\n\n")
              await navigator.clipboard.writeText(allScenes)
              setCopiedAll(true)
              setTimeout(() => setCopiedAll(false), 1500)
            }}
          >
            <CopyIcon className="size-3.5" weight="bold" aria-hidden />
            {copiedAll ? "Copied all" : "Copy all"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadText(splitIntoScenes(content).map((s) => `${s.label}\n\n${s.body}`).join("\n\n---\n\n"), filename)}>
            <DownloadSimpleIcon className="size-3.5" weight="bold" aria-hidden />
            Download
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {scenes.map((scene, i) => (
          <ScenePromptCard key={i} label={scene.label} body={scene.body} />
        ))}
      </div>

      {loadingNext && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <SpinnerIcon className="size-3.5 animate-spin" aria-hidden />
          {loadingLabel}
        </p>
      )}
    </section>
  )
}

function ScenePromptCard({ label, body }: { label: string; body: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <span className="truncate font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
          {label}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 gap-1.5 px-2.5 text-xs"
          onClick={async () => {
            await navigator.clipboard.writeText(body)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          <CopyIcon className="size-3" weight="bold" aria-hidden />
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="px-4 pb-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">{body}</pre>
    </div>
  )
}

function OutputBlock({
  title,
  content,
  filename,
  loadingNext,
  loadingLabel,
}: {
  title: string
  content: string
  filename: string
  loadingNext?: boolean
  loadingLabel?: string
}) {
  const [copied, setCopied] = useState(false)
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">{title}</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(stripMarkdown(content))
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
          >
            <CopyIcon className="size-3.5" weight="bold" aria-hidden />
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadText(stripMarkdown(content), filename)}>
            <DownloadSimpleIcon className="size-3.5" weight="bold" aria-hidden />
            Download
          </Button>
        </div>
      </div>
      <pre className="max-h-96 overflow-y-auto rounded-lg border border-border bg-card px-5 py-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
        {stripMarkdown(content)}
      </pre>
      {loadingNext && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <SpinnerIcon className="size-3.5 animate-spin" aria-hidden />
          {loadingLabel}
        </p>
      )}
    </section>
  )
}
