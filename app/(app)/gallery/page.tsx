import { PagePlaceholder } from "@/components/page-placeholder"

export const metadata = { title: "Gallery" }

export default function GalleryPage() {
  return (
    <PagePlaceholder
      eyebrow="Library"
      title="Gallery"
      description="Every generated scene image, grouped by pipeline run in scene order, with single and batch downloads."
    />
  )
}
