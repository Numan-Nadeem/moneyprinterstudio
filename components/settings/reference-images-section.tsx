"use client"

import { useRef, useState } from "react"
import { UploadSimpleIcon, TrashIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { useStudioSettings } from "@/hooks/use-studio-settings"

const MAX_SIZE_BYTES = 1.5 * 1024 * 1024 // keep localStorage safe

export function ReferenceImagesSection() {
  const { settings, update } = useStudioSettings()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    setError(null)
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue
      if (file.size > MAX_SIZE_BYTES) {
        setError(`"${file.name}" is larger than 1.5 MB. Use a smaller image in browser-storage mode.`)
        continue
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error("read failed"))
        reader.readAsDataURL(file)
      })
      try {
        update((s) => ({
          ...s,
          referenceImages: [
            ...s.referenceImages,
            { id: crypto.randomUUID(), name: file.name, dataUrl, createdAt: Date.now() },
          ],
        }))
      } catch {
        setError("Browser storage is full. Remove some images or connect a database for real storage.")
      }
    }
    if (inputRef.current) inputRef.current.value = ""
  }

  function removeImage(id: string) {
    update((s) => ({ ...s, referenceImages: s.referenceImages.filter((r) => r.id !== id) }))
  }

  return (
    <section aria-labelledby="reference-heading" className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="reference-heading" className="font-serif text-2xl tracking-tight text-foreground">
            Character Reference Images
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Attached to every Image Generator request to keep characters consistent across scenes.
          </p>
        </div>
        <Button size="sm" onClick={() => inputRef.current?.click()}>
          <UploadSimpleIcon className="size-4" weight="bold" aria-hidden />
          Upload
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => onFiles(e.target.files)}
          aria-label="Upload reference images"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-pastel-red px-4 py-2.5 text-sm text-pastel-red-foreground">
          {error}
        </p>
      )}

      {settings.referenceImages.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No reference images yet. Upload character stills to lock identity across all scenes.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {settings.referenceImages.map((img) => (
            <li key={img.id} className="group relative overflow-hidden rounded-lg border border-border bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.dataUrl} alt={img.name} className="aspect-[9/16] w-full object-cover" />
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="truncate font-mono text-xs text-muted-foreground">{img.name}</span>
                <button
                  type="button"
                  onClick={() => removeImage(img.id)}
                  aria-label={`Remove ${img.name}`}
                  className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-destructive"
                >
                  <TrashIcon className="size-3.5" weight="bold" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
