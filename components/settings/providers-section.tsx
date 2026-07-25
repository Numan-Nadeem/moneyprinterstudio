"use client"

import { useState } from "react"
import { PlusIcon, TrashIcon, CheckCircleIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useStudioSettings } from "@/hooks/use-studio-settings"
import {
  DEFAULT_MODELS,
  PROVIDER_KIND_LABELS,
  type ProviderKind,
} from "@/lib/store/types"

const KINDS: ProviderKind[] = ["gateway", "openai", "anthropic", "google"]

export function ProvidersSection() {
  const { settings, update } = useStudioSettings()
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState<ProviderKind>("gateway")
  const [label, setLabel] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [model, setModel] = useState(DEFAULT_MODELS.gateway)

  function resetForm() {
    setKind("gateway")
    setLabel("")
    setApiKey("")
    setModel(DEFAULT_MODELS.gateway)
    setAdding(false)
  }

  function addProvider() {
    if (!apiKey.trim() || !model.trim()) return
    const id = crypto.randomUUID()
    update((s) => ({
      ...s,
      providers: [
        ...s.providers,
        {
          id,
          kind,
          label: label.trim() || PROVIDER_KIND_LABELS[kind],
          apiKey: apiKey.trim(),
          model: model.trim(),
          createdAt: Date.now(),
        },
      ],
      defaultProviderId: s.defaultProviderId ?? id,
    }))
    resetForm()
  }

  function removeProvider(id: string) {
    update((s) => ({
      ...s,
      providers: s.providers.filter((p) => p.id !== id),
      defaultProviderId:
        s.defaultProviderId === id
          ? (s.providers.find((p) => p.id !== id)?.id ?? null)
          : s.defaultProviderId,
    }))
  }

  function setDefault(id: string) {
    update((s) => ({ ...s, defaultProviderId: id }))
  }

  return (
    <section aria-labelledby="providers-heading" className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="providers-heading" className="font-serif text-2xl tracking-tight text-foreground">
            AI Providers
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Bring your own API keys. Keys stay in this browser and are sent only with your requests.
          </p>
        </div>
        {!adding && (
          <Button onClick={() => setAdding(true)} size="sm">
            <PlusIcon className="size-4" weight="bold" aria-hidden />
            Add provider
          </Button>
        )}
      </div>

      {settings.providers.length === 0 && !adding && (
        <div className="rounded-lg border border-border bg-card px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No providers yet. Add one to start chatting with the agents.
          </p>
        </div>
      )}

      {settings.providers.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {settings.providers.map((p) => {
            const isDefault = settings.defaultProviderId === p.id
            return (
              <li key={p.id} className="flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{p.label}</span>
                    {isDefault && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-pastel-green px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-pastel-green-foreground">
                        <CheckCircleIcon className="size-3" weight="fill" aria-hidden />
                        Default
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {PROVIDER_KIND_LABELS[p.kind]} · {p.model} · key ····{p.apiKey.slice(-4)}
                  </p>
                </div>
                {!isDefault && (
                  <Button variant="ghost" size="sm" onClick={() => setDefault(p.id)}>
                    Make default
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${p.label}`}
                  onClick={() => removeProvider(p.id)}
                >
                  <TrashIcon className="size-4" weight="bold" aria-hidden />
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      {adding && (
        <form
          className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6"
          onSubmit={(e) => {
            e.preventDefault()
            addProvider()
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="provider-kind">Provider</Label>
              <Select
                value={kind}
                onValueChange={(v) => {
                  const k = v as ProviderKind
                  setKind(k)
                  setModel(DEFAULT_MODELS[k])
                }}
              >
                <SelectTrigger id="provider-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {PROVIDER_KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="provider-label">Label (optional)</Label>
              <Input
                id="provider-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={PROVIDER_KIND_LABELS[kind]}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="provider-key">API key</Label>
              <Input
                id="provider-key"
                type="password"
                required
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="provider-model">Model</Label>
              <Input
                id="provider-model"
                required
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={resetForm}>
              Cancel
            </Button>
            <Button type="submit">Save provider</Button>
          </div>
        </form>
      )}
    </section>
  )
}
