"use client"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
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

      <div className="flex flex-col gap-5 rounded-lg border border-border bg-card px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="auto-retry" className="text-sm font-medium">
              Auto-retry failed images
            </Label>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              When an image generation fails, automatically retry after a delay instead of stopping the pipeline.
            </p>
          </div>
          <Switch
            id="auto-retry"
            checked={settings.autoRetry}
            onCheckedChange={(checked) => update((s) => ({ ...s, autoRetry: checked }))}
          />
        </div>

        {settings.autoRetry && (
          <div className="grid grid-cols-2 gap-4 border-t border-border pt-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="retry-delay" className="text-sm font-medium">
                Retry delay
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="retry-delay"
                  type="number"
                  min={1}
                  max={120}
                  value={settings.retryDelaySeconds}
                  onChange={(e) =>
                    update((s) => ({
                      ...s,
                      retryDelaySeconds: Math.max(1, Math.min(120, Number(e.target.value) || 1)),
                    }))
                  }
                  className="w-24"
                />
                <span className="text-xs text-muted-foreground">seconds</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="max-retries" className="text-sm font-medium">
                Max retries
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="max-retries"
                  type="number"
                  min={1}
                  max={10}
                  value={settings.maxRetries}
                  onChange={(e) =>
                    update((s) => ({
                      ...s,
                      maxRetries: Math.max(1, Math.min(10, Number(e.target.value) || 1)),
                    }))
                  }
                  className="w-24"
                />
                <span className="text-xs text-muted-foreground">per scene</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
