"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowUpIcon,
  DownloadSimpleIcon,
  WarningCircleIcon,
  SpinnerIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useAgentProvider } from "@/hooks/use-agent-provider"
import { useStudioSettings } from "@/hooks/use-studio-settings"
import { useImageLibrary } from "@/hooks/use-image-library"
import { getImage } from "@/lib/store/image-db"
import { imageChatKey, loadJson, saveJson } from "@/lib/store/chat-store"
import type { AgentDefinition } from "@/lib/agents/registry"
import { toWireProvider } from "@/lib/store/types"

interface Turn {
  id: string
  prompt: string
  status: "generating" | "done" | "error"
  image?: string
  text?: string | null
  error?: string
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a")
  a.href = dataUrl
  a.download = filename
  a.click()
}

export function ImageChat({
  agent,
  sessionId,
  onFirstMessage,
}: {
  agent: AgentDefinition
  sessionId: string
  onFirstMessage?: (text: string) => void
}) {
  const { provider, instructions } = useAgentProvider(agent.id, { image: true })
  const { settings } = useStudioSettings()
  const { add } = useImageLibrary()
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState("")
  const [useContinuity, setUseContinuity] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const restored = useRef(false)
  const hasScrolledInitially = useRef(false)

  const busy = turns.some((t) => t.status === "generating")

  // Restore previous turns (metadata from localStorage, images from IndexedDB)
  useEffect(() => {
    let active = true
    async function restore() {
      const saved = loadJson<Omit<Turn, "image">[]>(imageChatKey(agent.id, sessionId))
      if (saved?.length) {
        const hydrated = await Promise.all(
          saved.map(async (t): Promise<Turn> => {
            if (t.status === "generating") {
              return { ...t, status: "error", error: "Generation was interrupted by navigation." }
            }
            if (t.status === "done") {
              const stored = await getImage(t.id)
              return stored
                ? { ...t, image: stored.dataUrl }
                : { ...t, status: "error", error: "Image was removed from the gallery." }
            }
            return t
          }),
        )
        if (active) setTurns(hydrated)
      }
      restored.current = true
    }
    void restore()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id, sessionId])

  // Persist turn metadata (images live in IndexedDB, keyed by turn id)
  useEffect(() => {
    if (!restored.current) return
    saveJson(
      imageChatKey(agent.id, sessionId),
      turns.map(({ image: _image, ...rest }) => rest),
    )
  }, [turns, agent.id, sessionId])

  // Jump straight to the bottom once restored turns load (no visible scroll
  // animation from the top); animate smoothly only for turns added afterward.
  // Skipped until restore() finishes so the initial empty render doesn't
  // consume the "instant scroll" before the real content arrives.
  useEffect(() => {
    if (!restored.current) return
    bottomRef.current?.scrollIntoView({ behavior: hasScrolledInitially.current ? "smooth" : "auto" })
    hasScrolledInitially.current = true
  }, [turns])

  async function submit() {
    const prompt = input.trim()
    if (!prompt || busy || !provider) return
    if (turns.length === 0) onFirstMessage?.(prompt)
    setInput("")

    const id = crypto.randomUUID()
    setTurns((prev) => [...prev, { id, prompt, status: "generating" }])

    // Continuity inputs: character references + the previous generated image
    const previous = useContinuity
      ? [...turns].reverse().find((t) => t.status === "done" && t.image)?.image
      : undefined
    const referenceImages = [
      ...(useContinuity ? settings.referenceImages.map((r) => r.dataUrl) : []),
      ...(previous ? [previous] : []),
    ].slice(0, 8)

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          provider: toWireProvider(provider),
          instructions,
          referenceImages,
        }),
      })
      const data = (await res.json()) as { image?: string; text?: string | null; error?: string }
      if (!res.ok || !data.image) {
        throw new Error(data.error || "Image generation failed")
      }
      setTurns((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: "done", image: data.image, text: data.text } : t)),
      )
      await add({
        id,
        dataUrl: data.image,
        prompt,
        sceneIndex: null,
        sceneTitle: null,
        model: provider.model,
        createdAt: Date.now(),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Image generation failed"
      setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, status: "error", error: message } : t)))
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-8">
          {turns.length === 0 && (
            <div className="flex flex-col items-start gap-2 rounded-lg border border-border bg-card px-6 py-5">
              <p className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
                {agent.shortName}
              </p>
              <p className="font-serif text-xl tracking-tight text-foreground">{agent.openingLine}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                One prompt in, one cinematic 9:16 image out.{" "}
                {settings.referenceImages.length > 0
                  ? `${settings.referenceImages.length} character reference image(s) will be attached for continuity.`
                  : "Add character reference images in Settings for stronger continuity."}
              </p>
            </div>
          )}

          {turns.map((turn, i) => (
            <div key={turn.id} className="flex flex-col gap-3">
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-lg bg-primary px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-primary-foreground">
                  {turn.prompt}
                </div>
              </div>

              {turn.status === "generating" && (
                <div className="flex aspect-[9/16] w-56 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card">
                  <SpinnerIcon className="size-5 animate-spin text-muted-foreground" aria-hidden />
                  <p className="font-mono text-xs text-muted-foreground" role="status">
                    Generating scene {i + 1}…
                  </p>
                </div>
              )}

              {turn.status === "error" && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-md bg-pastel-red px-4 py-3 text-sm text-pastel-red-foreground"
                >
                  <WarningCircleIcon className="mt-0.5 size-4 shrink-0" weight="bold" aria-hidden />
                  <span>{turn.error}</span>
                </div>
              )}

              {turn.status === "done" && turn.image && (
                <div className="flex flex-col items-start gap-2">
                  <div className="group relative w-64 overflow-hidden rounded-lg border border-border bg-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={turn.image}
                      alt={`Generated scene ${i + 1}: ${turn.prompt.slice(0, 80)}`}
                      className="aspect-[9/16] w-full object-cover"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadDataUrl(turn.image!, `scene-${i + 1}.png`)}
                    >
                      <DownloadSimpleIcon className="size-3.5" weight="bold" aria-hidden />
                      Download
                    </Button>
                    <span className="font-mono text-[10px] text-muted-foreground">Saved to gallery</span>
                  </div>
                  {turn.text && <p className="max-w-md text-xs leading-relaxed text-muted-foreground">{turn.text}</p>}
                </div>
              )}
            </div>
          ))}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t bg-background">
        <div className="mx-auto w-full max-w-3xl px-6 py-4">
          {!provider ? (
            <p className="rounded-md bg-pastel-yellow px-4 py-3 text-sm text-pastel-yellow-foreground">
              No AI provider configured.{" "}
              <Link href="/settings" className="font-medium underline underline-offset-2">
                Add one in Settings
              </Link>{" "}
              with an image-capable model.
            </p>
          ) : (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  submit()
                }}
                className="flex items-end gap-2 rounded-lg border border-border bg-card p-2 focus-within:border-ring"
              >
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                      e.preventDefault()
                      submit()
                    }
                  }}
                  placeholder={agent.openingLine}
                  aria-label={`Prompt for ${agent.name}`}
                  className="max-h-48 min-h-10 flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                  rows={1}
                  disabled={busy}
                />
                <Button type="submit" size="icon" disabled={!input.trim() || busy} aria-label="Generate image">
                  {busy ? (
                    <SpinnerIcon className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <ArrowUpIcon className="size-4" weight="bold" aria-hidden />
                  )}
                </Button>
              </form>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch id="continuity" checked={useContinuity} onCheckedChange={setUseContinuity} />
                  <Label htmlFor="continuity" className="text-xs text-muted-foreground">
                    Attach references + previous scene for continuity
                  </Label>
                </div>
                <p className="font-mono text-[10px] tracking-wide text-muted-foreground">
                  {provider.label} · {provider.model}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
