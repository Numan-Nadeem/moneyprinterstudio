export type ProviderKind = "gateway" | "openai" | "anthropic" | "google"

export interface ProviderConfig {
  id: string
  kind: ProviderKind
  label: string
  apiKey: string
  model: string
  createdAt: number
}

export interface AgentSettings {
  /** Extra user instructions appended to the agent's master prompt */
  instructions: string
  /** Provider config id assigned to this agent; falls back to default */
  providerId: string | null
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

export const PROVIDER_KIND_LABELS: Record<ProviderKind, string> = {
  gateway: "Vercel AI Gateway",
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
}

export const DEFAULT_MODELS: Record<ProviderKind, string> = {
  gateway: "anthropic/claude-sonnet-5",
  openai: "gpt-5.5",
  anthropic: "claude-sonnet-5",
  google: "gemini-3.1-pro-preview",
}

/** Image-capable model defaults for the Image Generator agent */
export const DEFAULT_IMAGE_MODELS: Record<ProviderKind, string> = {
  gateway: "google/gemini-3.1-flash-image",
  openai: "gpt-image-2",
  anthropic: "",
  google: "gemini-3.1-flash-image",
}
