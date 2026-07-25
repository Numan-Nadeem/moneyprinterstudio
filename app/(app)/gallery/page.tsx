import { GalleryGrid } from "@/components/gallery/gallery-grid"

export const metadata = { title: "Gallery" }

export default function GalleryPage() {
  return (
    <main className="min-h-svh">
      <GalleryGrid />
    </main>
  )
}
