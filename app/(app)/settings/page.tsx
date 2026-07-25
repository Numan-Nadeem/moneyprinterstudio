import { Separator } from "@/components/ui/separator"
import { ProvidersSection } from "@/components/settings/providers-section"
import { AgentsSection } from "@/components/settings/agents-section"
import { ReferenceImagesSection } from "@/components/settings/reference-images-section"
import { PipelineSection } from "@/components/settings/pipeline-section"

export const metadata = { title: "Settings" }

export default function SettingsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12 md:py-16">
      <header className="animate-fade-up">
        <p className="font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase">Configuration</p>
        <h1 className="mt-2 font-serif text-4xl tracking-tight text-balance text-foreground">Settings</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Providers, per-agent instructions, character references, and pipeline behavior. Data is
          stored in this browser until a database is connected.
        </p>
      </header>

      <div className="mt-12 flex flex-col gap-12">
        <ProvidersSection />
        <Separator />
        <AgentsSection />
        <Separator />
        <ReferenceImagesSection />
        <Separator />
        <PipelineSection />
      </div>
    </main>
  )
}
