"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AGENTS } from "@/lib/agents/registry"
import { useStudioSettings } from "@/hooks/use-studio-settings"

const NONE = "__default__"

function AgentRow({ agentId, name, description }: { agentId: string; name: string; description: string }) {
  const { settings, update } = useStudioSettings()
  const current = settings.agentSettings[agentId] ?? { instructions: "", providerId: null }
  const [draft, setDraft] = useState(current.instructions)
  const dirty = draft !== current.instructions

  function save() {
    update((s) => ({
      ...s,
      agentSettings: {
        ...s.agentSettings,
        [agentId]: { ...(s.agentSettings[agentId] ?? { providerId: null }), instructions: draft },
      },
    }))
  }

  function setProvider(providerId: string | null, model: string | null) {
    update((s) => ({
      ...s,
      agentSettings: {
        ...s.agentSettings,
        [agentId]: { ...(s.agentSettings[agentId] ?? { instructions: "" }), providerId, model },
      },
    }))
  }

  // Resolve the provider + model this agent will actually use
  const assigned = current.providerId
    ? settings.providers.find((p) => p.id === current.providerId)
    : undefined
  const fallback = settings.defaultProviderId
    ? settings.providers.find((p) => p.id === settings.defaultProviderId)
    : undefined
  const effective = assigned ?? fallback ?? settings.providers[0]
  const overrideValid =
    assigned &&
    current.model &&
    (current.model === assigned.model || assigned.models?.some((m) => m.id === current.model))
  const effectiveModel = overrideValid ? current.model : effective?.model

  // Selection value encodes provider + optional model: "id" or "id::model".
  // For multi-model providers without an override, reflect the provider's
  // active model so the trigger always shows what will actually run.
  const isMultiModel = (p: (typeof settings.providers)[number] | undefined) =>
    (p?.models?.filter((m) => m.id).length ?? 0) > 1
  const selectValue = current.providerId
    ? overrideValid
      ? `${current.providerId}::${current.model}`
      : isMultiModel(assigned)
        ? `${current.providerId}::${assigned?.model}`
        : current.providerId
    : NONE

  function onSelect(v: string) {
    if (v === NONE) {
      setProvider(null, null)
      return
    }
    const sep = v.indexOf("::")
    if (sep === -1) {
      setProvider(v, null)
    } else {
      setProvider(v.slice(0, sep), v.slice(sep + 2))
    }
  }

  return (
    <li className="flex flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{name}</h3>
          <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <div className="flex w-56 shrink-0 flex-col gap-1.5">
          <Label htmlFor={`provider-${agentId}`} className="text-xs">
            Provider
          </Label>
          <Select value={selectValue} onValueChange={onSelect}>
            <SelectTrigger id={`provider-${agentId}`} size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Default provider</SelectItem>
              {settings.providers.flatMap((p) => {
                const models = p.models?.filter((m) => m.id) ?? []
                if (models.length > 1) {
                  // One option per model so the exact model can be chosen
                  return models.map((m) => (
                    <SelectItem key={`${p.id}::${m.id}`} value={`${p.id}::${m.id}`}>
                      {p.label} — {m.label || m.id}
                    </SelectItem>
                  ))
                }
                return (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          {effective && (
            <p className="truncate font-mono text-xs text-muted-foreground">
              Uses: {effective.label} · {effectiveModel}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`instructions-${agentId}`} className="text-xs">
          Additional instructions (appended to the master prompt)
        </Label>
        <Textarea
          id={`instructions-${agentId}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. Always answer in English. Keep dialogue under 10 words per scene."
          className="min-h-20 text-sm"
        />
        {dirty && (
          <div className="flex justify-end">
            <Button size="sm" onClick={save}>
              Save instructions
            </Button>
          </div>
        )}
      </div>
    </li>
  )
}

export function AgentsSection() {
  return (
    <section aria-labelledby="agents-heading" className="flex flex-col gap-6">
      <div>
        <h2 id="agents-heading" className="font-serif text-2xl tracking-tight text-foreground">
          Agent Configuration
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Master prompts are fixed. Add per-agent instructions and assign a provider to each agent.
        </p>
      </div>
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
        {AGENTS.map((a) => (
          <AgentRow key={a.id} agentId={a.id} name={a.name} description={a.description} />
        ))}
      </ul>
    </section>
  )
}
