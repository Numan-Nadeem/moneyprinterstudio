import { PagePlaceholder } from "@/components/page-placeholder"

export const metadata = { title: "Settings" }

export default function SettingsPage() {
  return (
    <PagePlaceholder
      eyebrow="Configuration"
      title="Settings"
      description="Bring your own API keys for text and image providers, set global instructions, and attach character reference images."
    />
  )
}
