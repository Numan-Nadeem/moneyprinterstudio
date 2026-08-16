"use client"

import { useState } from "react"
import { CopyIcon, CheckIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { splitIntoScenes } from "@/lib/pipeline/scene-utils"

export function ScenePromptCard({ label, body }: { label: string; body: string }) {
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
          {copied ? (
            <CheckIcon className="size-3" weight="bold" aria-hidden />
          ) : (
            <CopyIcon className="size-3" weight="bold" aria-hidden />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto px-4 pb-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">{body}</pre>
    </div>
  )
}

/**
 * Renders a multi-scene text response as one copy-ready card per scene,
 * matching the pipeline output. Used by prompt-extractor agent chats so each
 * scene's prompt can be copied individually.
 */
export function ScenePromptCards({ text }: { text: string }) {
  const scenes = splitIntoScenes(text)
  return (
    <div className="flex flex-col gap-3">
      {scenes.map((scene, i) => (
        <ScenePromptCard key={i} label={scene.label} body={scene.body} />
      ))}
    </div>
  )
}
