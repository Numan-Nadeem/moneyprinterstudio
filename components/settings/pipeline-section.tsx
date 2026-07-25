"use client"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useStudioSettings } from "@/hooks/use-studio-settings"

export function PipelineSection() {
  const { settings, update } = useStudioSettings()

  return (
    <section aria-labelledby="pipeline-heading" className="flex flex-col gap-6">
      <div>
        <h2 id="pipeline-heading" className="font-serif text-2xl tracking-tight text-foreground">
          Pipeline Behavior
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Controls how the delegation pipeline moves between stages.
        </p>
      </div>
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-6 py-5">
        <div>
          <Label htmlFor="auto-continue" className="text-sm font-medium">
            Auto-continue between stages
          </Label>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            When off, the pipeline pauses after each stage and waits for your confirmation.
          </p>
        </div>
        <Switch
          id="auto-continue"
          checked={settings.autoContinue}
          onCheckedChange={(checked) => update((s) => ({ ...s, autoContinue: checked }))}
        />
      </div>
    </section>
  )
}
