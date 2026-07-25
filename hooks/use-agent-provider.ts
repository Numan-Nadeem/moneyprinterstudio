"use client"

import { useStudioSettings } from "@/hooks/use-studio-settings"
import type { ProviderConfig } from "@/lib/store/types"

/**
 * Resolves the effective provider + instructions for an agent:
 * agent-assigned provider first, then the default provider.
 */
export function useAgentProvider(agentId: string): {
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

  return {
    provider: assigned ?? fallback ?? settings.providers[0] ?? null,
    instructions: agentSettings?.instructions ?? "",
  }
}
