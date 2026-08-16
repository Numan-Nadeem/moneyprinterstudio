"use client"

/**
 * Lightweight localStorage persistence for chat sessions so conversations
 * survive tab navigation. Text only — generated images are stored in
 * IndexedDB (see image-db.ts) and rehydrated by id.
 */

export function loadJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function saveJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Quota exceeded or storage unavailable: skip persistence rather than crash.
  }
}

export function removeJson(key: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

export const chatKey = (agentId: string, sessionId: string) => `mps:chat:${agentId}:${sessionId}:v1`
export const imageChatKey = (agentId: string, sessionId: string) =>
  `mps:image-chat:${agentId}:${sessionId}:v1`
export const PIPELINE_KEY = "mps:pipeline:v1"
