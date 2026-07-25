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
  type CustomModelEntry,
  type ProviderKind,
} from "@/lib/store/types"

const KINDS: ProviderKind[] = ["gateway", "openai", "anthropic", "google", "custom"]

const SLUG_RE = /^[a-z0-9_-]+$/

interface HeaderRow {
  name: string
  value: string
}

export function ProvidersSection() {
  const { settings, update } = useStudioSettings()
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState<ProviderKind>("gateway")
  const [label, setLabel] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [model, setModel] = useState(DEFAULT_MODELS.gateway)
  // Custom provider fields
  const [providerId, setProviderId] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [models, setModels] = useState<CustomModelEntry[]>([{ id: "", label: "" }])
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>([])

  const isCustom = kind === "custom"

  function resetForm() {
    setKind("gateway")
    setLabel("")
    setApiKey("")
    setModel(DEFAULT_MODELS.gateway)
    setProviderId("")
    setBaseUrl("")
    setModels([{ id: "", label: "" }])
    setHeaderRows([])
    setAdding(false)
  }

  function addProvider() {
    const id = crypto.randomUUID()

    if (isCustom) {
      const cleanModels = models
        .map((m) => ({ id: m.id.trim(), label: m.label.trim() || m.id.trim() }))
        .filter((m) => m.id)
      const cleanHeaders = Object.fromEntries(
        headerRows
          .map((h) => [h.name.trim(), h.value.trim()] as const)
          .filter(([n]) => n),
      )
      if (
        !providerId.trim() ||
        !SLUG_RE.test(providerId.trim()) ||
        !baseUrl.trim() ||
        cleanModels.length === 0
      ) {
        return
      }
      update((s) => ({
        ...s,
        providers: [
          ...s.providers,
          {
            id,
            kind: "custom" as const,
            label: label.trim() || providerId.trim(),
            apiKey: apiKey.trim(),
            model: cleanModels[0].id,
            createdAt: Date.now(),
            providerId: providerId.trim(),
            baseUrl: baseUrl.trim(),
            headers: Object.keys(cleanHeaders).length > 0 ? cleanHeaders : undefined,
            models: cleanModels,
          },
        ],
        defaultProviderId: s.defaultProviderId ?? id,
      }))
      resetForm()
      return
    }

    if (!apiKey.trim() || !model.trim()) return
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

  function setProviderModel(id: string, modelId: string) {
    update((s) => ({
      ...s,
      providers: s.providers.map((p) => (p.id === id ? { ...p, model: modelId } : p)),
      // Swapping the active model is authoritative: clear per-agent model
      // overrides pointing at this provider so the swap applies everywhere.
      agentSettings: Object.fromEntries(
        Object.entries(s.agentSettings).map(([agentId, as]) => [
          agentId,
          as.providerId === id ? { ...as, model: null } : as,
        ]),
      ),
    }))
  }

  const customValid =
    !isCustom ||
    (Boolean(providerId.trim()) &&
      SLUG_RE.test(providerId.trim()) &&
      Boolean(baseUrl.trim()) &&
      models.some((m) => m.id.trim()))

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
                    {PROVIDER_KIND_LABELS[p.kind]}
                    {p.kind === "custom" && p.baseUrl ? ` · ${p.baseUrl}` : ""} · {p.model}
                    {p.apiKey ? ` · key ····${p.apiKey.slice(-4)}` : " · headers auth"}
                  </p>
                </div>
                {p.kind === "custom" && (p.models?.length ?? 0) > 1 && (
                  <Select value={p.model} onValueChange={(v) => setProviderModel(p.id, v)}>
                    <SelectTrigger
                      aria-label={`Active model for ${p.label}`}
                      size="sm"
                      className="max-w-44 font-mono text-xs"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {p.models?.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label || m.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
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
              <Label htmlFor="provider-label">{isCustom ? "Display name" : "Label (optional)"}</Label>
              <Input
                id="provider-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={isCustom ? "My AI Provider" : PROVIDER_KIND_LABELS[kind]}
              />
            </div>

            {isCustom && (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="provider-slug">Provider ID</Label>
                  <Input
                    id="provider-slug"
                    required
                    value={providerId}
                    onChange={(e) => setProviderId(e.target.value)}
                    placeholder="myprovider"
                    className="font-mono"
                    aria-describedby="provider-slug-hint"
                  />
                  <p id="provider-slug-hint" className="text-xs text-muted-foreground">
                    Lowercase letters, numbers, hyphens, or underscores
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="provider-base-url">Base URL</Label>
                  <Input
                    id="provider-base-url"
                    required
                    type="url"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://api.myprovider.com/v1"
                    className="font-mono"
                  />
                </div>
              </>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="provider-key">API key</Label>
              <Input
                id="provider-key"
                type="password"
                required={!isCustom}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={isCustom ? "API key" : "sk-..."}
                autoComplete="off"
                aria-describedby={isCustom ? "provider-key-hint" : undefined}
              />
              {isCustom && (
                <p id="provider-key-hint" className="text-xs text-muted-foreground">
                  Optional. Leave empty if you manage auth via headers.
                </p>
              )}
            </div>

            {!isCustom && (
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
            )}
          </div>

          {isCustom && (
            <>
              {/* Models list */}
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-medium text-foreground">Models</legend>
                {models.map((m, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      aria-label={`Model ${i + 1} ID`}
                      value={m.id}
                      onChange={(e) =>
                        setModels((rows) =>
                          rows.map((r, j) => (j === i ? { ...r, id: e.target.value } : r)),
                        )
                      }
                      placeholder="model-id"
                      className="font-mono"
                    />
                    <Input
                      aria-label={`Model ${i + 1} display name`}
                      value={m.label}
                      onChange={(e) =>
                        setModels((rows) =>
                          rows.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)),
                        )
                      }
                      placeholder="Display Name"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove model ${i + 1}`}
                      disabled={models.length === 1}
                      onClick={() => setModels((rows) => rows.filter((_, j) => j !== i))}
                    >
                      <TrashIcon className="size-4" weight="bold" aria-hidden />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onClick={() => setModels((rows) => [...rows, { id: "", label: "" }])}
                >
                  <PlusIcon className="size-4" weight="bold" aria-hidden />
                  Add model
                </Button>
              </fieldset>

              {/* Headers list */}
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-medium text-foreground">
                  Headers (optional)
                </legend>
                {headerRows.map((h, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      aria-label={`Header ${i + 1} name`}
                      value={h.name}
                      onChange={(e) =>
                        setHeaderRows((rows) =>
                          rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)),
                        )
                      }
                      placeholder="Header-Name"
                      className="font-mono"
                    />
                    <Input
                      aria-label={`Header ${i + 1} value`}
                      value={h.value}
                      onChange={(e) =>
                        setHeaderRows((rows) =>
                          rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)),
                        )
                      }
                      placeholder="value"
                      className="font-mono"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove header ${i + 1}`}
                      onClick={() => setHeaderRows((rows) => rows.filter((_, j) => j !== i))}
                    >
                      <TrashIcon className="size-4" weight="bold" aria-hidden />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onClick={() => setHeaderRows((rows) => [...rows, { name: "", value: "" }])}
                >
                  <PlusIcon className="size-4" weight="bold" aria-hidden />
                  Add header
                </Button>
              </fieldset>
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={resetForm}>
              Cancel
            </Button>
            <Button type="submit" disabled={!customValid}>
              Save provider
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}
