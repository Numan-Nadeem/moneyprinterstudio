"use client"

import { useStudioSettings } from "@/hooks/use-studio-settings"
import { DEFAULT_IMAGE_MODELS, type ProviderConfig } from "@/lib/store/types"

/**
 * Resolves the effective provider + instructions for an agent:
 * agent-assigned provider first, then the default provider.
 * For image agents, the provider's text model is swapped for the
 * image-capable default of that provider kind.
 */
export function useAgentProvider(
  agentId: string,
  options?: { image?: boolean },
): {
  provider: ProviderConfig | null
  instructions: string
} {
  const { settings } = useStudioSettings()
  const agentSettings = settings.agentSettings[agentId]

  const assigned = agentSettings?.providerId
    ? settings.providers.find((p) => p.id === agentSettings.providerId)
    : undefined
  const fallback = settings.defaultProviderId
    ? settings.providers.find((p) => p.id === settings.defaultProviderId)
    : undefined

  let provider: ProviderConfig | null = assigned ?? fallback ?? settings.providers[0] ?? null

  if (provider && options?.image) {
    const imageModel = DEFAULT_IMAGE_MODELS[provider.kind]
    if (!imageModel) {
      // Provider kind cannot generate images (e.g. Anthropic): try to find
      // any configured provider that can.
      const capable = settings.providers.find((p) => DEFAULT_IMAGE_MODELS[p.kind])
      provider = capable ? { ...capable, model: DEFAULT_IMAGE_MODELS[capable.kind] } : null
    } else {
      provider = { ...provider, model: imageModel }
    }
  }

  return {
    provider,
    instructions: agentSettings?.instructions ?? "",
  }
}
