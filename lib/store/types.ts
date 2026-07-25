export type ProviderKind = "gateway" | "openai" | "anthropic" | "google" | "custom"

export interface CustomModelEntry {
  id: string
  label: string
}

export interface ProviderConfig {
  id: string
  kind: ProviderKind
  label: string
  apiKey: string
  model: string
  createdAt: number
  /** Custom (OpenAI-compatible) provider fields */
  providerId?: string
  baseUrl?: string
  headers?: Record<string, string>
  models?: CustomModelEntry[]
}

export interface AgentSettings {
  /** Extra user instructions appended to the agent's master prompt */
  instructions: string
  /** Provider config id assigned to this agent; falls back to default */
  providerId: string | null
  /** Specific model id chosen for this agent (multi-model providers) */
  model?: string | null
}

/**
 * Applies an agent's model override to its resolved provider. Only applies
 * when the override model actually belongs to that provider's model list
 * (or is its base model), so stale overrides are ignored safely.
 */
export function applyModelOverride(
  provider: ProviderConfig,
  agentSettings: AgentSettings | undefined,
): ProviderConfig {
  const override = agentSettings?.model
  if (!override || agentSettings?.providerId !== provider.id) return provider
  const valid = override === provider.model || provider.models?.some((m) => m.id === override)
  return valid ? { ...provider, model: override } : provider
}

export interface ReferenceImage {
  id: string
  name: string
  /** data URL (client-side storage mode) */
  dataUrl: string
  createdAt: number
}

export interface StudioSettings {
  providers: ProviderConfig[]
  defaultProviderId: string | null
  /** keyed by agent id */
  agentSettings: Record<string, AgentSettings>
  referenceImages: ReferenceImage[]
  /** pipeline confirmation mode */
  autoContinue: boolean
}

export const EMPTY_SETTINGS: StudioSettings = {
  providers: [],
  defaultProviderId: null,
  agentSettings: {},
  referenceImages: [],
  autoContinue: false,
}

/** Serializes a provider config into the per-request wire payload. */
export function toWireProvider(p: ProviderConfig) {
  return {
    kind: p.kind,
    apiKey: p.apiKey,
    model: p.model,
    ...(p.kind === "custom" ? { baseUrl: p.baseUrl, headers: p.headers } : {}),
  }
}

export const PROVIDER_KIND_LABELS: Record<ProviderKind, string> = {
  gateway: "Vercel AI Gateway",
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  custom: "Custom (OpenAI-compatible)",
}

export const DEFAULT_MODELS: Record<ProviderKind, string> = {
  gateway: "anthropic/claude-sonnet-5",
  openai: "gpt-5.5",
  anthropic: "claude-sonnet-5",
  google: "gemini-3.1-pro-preview",
  custom: "",
}

/**
 * Image-capable model defaults for the Image Generator agent.
 * Custom providers keep their user-configured model as-is.
 */
export const DEFAULT_IMAGE_MODELS: Record<ProviderKind, string> = {
  gateway: "google/gemini-3.1-flash-image",
  openai: "gpt-image-2",
  anthropic: "",
  google: "gemini-3.1-flash-image",
  custom: "",
}
