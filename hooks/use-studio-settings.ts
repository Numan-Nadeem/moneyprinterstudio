"use client"

import useSWR from "swr"
import { EMPTY_SETTINGS, type StudioSettings } from "@/lib/store/types"

const STORAGE_KEY = "mps:settings:v1"

function readSettings(): StudioSettings {
  if (typeof window === "undefined") return EMPTY_SETTINGS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_SETTINGS
    return { ...EMPTY_SETTINGS, ...(JSON.parse(raw) as Partial<StudioSettings>) }
  } catch {
    return EMPTY_SETTINGS
  }
}

function writeSettings(settings: StudioSettings) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

/**
 * Client-side settings store (temporary persistence mode).
 * Swappable for a database-backed implementation later: keep the same
 * return shape and replace the fetcher/mutator with API calls.
 */
export function useStudioSettings() {
  const { data, mutate, isLoading } = useSWR<StudioSettings>("studio-settings", readSettings, {
    fallbackData: EMPTY_SETTINGS,
    revalidateOnFocus: false,
  })

  const settings = data ?? EMPTY_SETTINGS

  function update(updater: (current: StudioSettings) => StudioSettings) {
    const next = updater(readSettings())
    writeSettings(next)
    mutate(next, { revalidate: false })
  }

  return { settings, update, isLoading }
}
