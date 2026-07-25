"use client"

import { useState } from "react"
import Link from "next/link"
import JSZip from "jszip"
import {
  DownloadSimpleIcon,
  FileArchiveIcon,
  ImagesIcon,
  SpinnerIcon,
  TrashIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useImageLibrary } from "@/hooks/use-image-library"
import type { GeneratedImage } from "@/lib/store/image-db"

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a")
  a.href = dataUrl
  a.download = filename
  a.click()
}

function imageFilename(image: GeneratedImage): string {
  if (image.sceneIndex != null) return `scene-${String(image.sceneIndex).padStart(2, "0")}.png`
  return `image-${new Date(image.createdAt).toISOString().slice(0, 19).replaceAll(":", "-")}.png`
}

export function GalleryGrid() {
  const { images, remove, isLoading } = useImageLibrary()
  const [selected, setSelected] = useState<GeneratedImage | null>(null)
  const [zipping, setZipping] = useState(false)

  async function downloadAll() {
    setZipping(true)
    try {
      const zip = new JSZip()
      const used = new Set<string>()
      for (const image of images) {
        let name = imageFilename(image)
        while (used.has(name)) name = name.replace(/\.png$/, "-1.png")
        used.add(name)
        zip.file(name, image.dataUrl.split(",")[1] ?? "", { base64: true })
      }
      const blob = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "moneyprinter-gallery.zip"
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setZipping(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-2xl tracking-tight text-balance">Gallery</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Every generated scene image, saved automatically. Click an image for its prompt.
          </p>
        </div>
        {images.length > 0 && (
          <Button variant="outline" onClick={downloadAll} disabled={zipping}>
            {zipping ? (
              <SpinnerIcon className="size-4 animate-spin" aria-hidden />
            ) : (
              <FileArchiveIcon className="size-4" weight="bold" aria-hidden />
            )}
            Download all ({images.length})
          </Button>
        )}
      </header>

      {isLoading ? (
        <p className="font-mono text-xs text-muted-foreground" role="status">
          Loading library…
        </p>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card px-6 py-10">
          <ImagesIcon className="size-6 text-muted-foreground" aria-hidden />
          <p className="font-serif text-lg tracking-tight">No images yet.</p>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Generate scene images with the{" "}
            <Link href="/agents/image-generator" className="underline underline-offset-2">
              Image Generator
            </Link>{" "}
            or run the full{" "}
            <Link href="/pipeline" className="underline underline-offset-2">
              Delegation Pipeline
            </Link>
            . Everything lands here automatically.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {images.map((image) => (
            <li key={image.id}>
              <button
                type="button"
                onClick={() => setSelected(image)}
                className="group relative block w-full overflow-hidden rounded-lg border border-border bg-card text-left transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                aria-label={`Open ${image.sceneTitle ?? "image"} details`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.dataUrl}
                  alt={image.sceneTitle ?? image.prompt.slice(0, 80)}
                  className="aspect-[9/16] w-full object-cover"
                />
                <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-background/90 px-3 py-2">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {image.sceneIndex != null ? `Scene ${image.sceneIndex}` : "Single shot"}
                  </span>
                  <span className="truncate text-xs font-medium">
                    {image.sceneTitle ?? image.prompt.slice(0, 40)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif tracking-tight">
                  {selected.sceneTitle ?? "Generated image"}
                </DialogTitle>
                <DialogDescription className="font-mono text-[11px]">
                  {selected.model} · {new Date(selected.createdAt).toLocaleString()}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4 sm:flex-row">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selected.dataUrl}
                  alt={selected.sceneTitle ?? "Generated image"}
                  className="aspect-[9/16] w-full max-w-56 rounded-lg border border-border object-cover"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <p className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">Prompt</p>
                  <p className="max-h-64 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap">
                    {selected.prompt}
                  </p>
                  <div className="mt-auto flex items-center gap-2">
                    <Button onClick={() => downloadDataUrl(selected.dataUrl, imageFilename(selected))}>
                      <DownloadSimpleIcon className="size-4" weight="bold" aria-hidden />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        await remove(selected.id)
                        setSelected(null)
                      }}
                    >
                      <TrashIcon className="size-4" weight="bold" aria-hidden />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
