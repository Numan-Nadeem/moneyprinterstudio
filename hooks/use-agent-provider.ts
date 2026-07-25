"use client"

import { useStudioSettings } from "@/hooks/use-studio-settings"
import { DEFAULT_IMAGE_MODELS, applyModelOverride, type ProviderConfig } from "@/lib/store/types"

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
  if (provider) provider = applyModelOverride(provider, agentSettings)

  if (provider && options?.image && provider.kind !== "custom") {
    // Custom providers keep their user-configured model; built-in kinds swap
    // to their image-capable default.
    const imageModel = DEFAULT_IMAGE_MODELS[provider.kind]
    if (!imageModel) {
      // Provider kind cannot generate images (e.g. Anthropic): try to find
      // any configured provider that can.
      const capable = settings.providers.find(
        (p) => p.kind === "custom" || DEFAULT_IMAGE_MODELS[p.kind],
      )
      provider = capable
        ? capable.kind === "custom"
          ? capable
          : { ...capable, model: DEFAULT_IMAGE_MODELS[capable.kind] }
        : null
    } else {
      provider = { ...provider, model: imageModel }
    }
  }

  return {
    provider,
    instructions: agentSettings?.instructions ?? "",
  }
}
