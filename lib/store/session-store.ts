"use client"

import { loadJson, removeJson, saveJson } from "@/lib/store/chat-store"

/**
 * Per-agent chat sessions. Each session is a fully isolated conversation:
 * it has its own message history in localStorage (see chatKey/imageChatKey)
 * and its own Chat instance in the registry. Nothing is ever shared between
 * sessions, so a request only ever carries the CURRENT session's context.
 */
export interface ChatSession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

export const DEFAULT_SESSION_TITLE = "New chat"

const sessionsKey = (agentId: string) => `mps:sessions:${agentId}:v1`
const activeKey = (agentId: string) => `mps:active-session:${agentId}:v1`

export function createSessionId(): string {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function loadSessions(agentId: string): ChatSession[] {
  return loadJson<ChatSession[]>(sessionsKey(agentId)) ?? []
}

export function saveSessions(agentId: string, sessions: ChatSession[]): void {
  saveJson(sessionsKey(agentId), sessions)
}

export function loadActiveSessionId(agentId: string): string | null {
  return loadJson<string>(activeKey(agentId))
}

export function saveActiveSessionId(agentId: string, id: string): void {
  saveJson(activeKey(agentId), id)
}

export function newSession(): ChatSession {
  const now = Date.now()
  return { id: createSessionId(), title: DEFAULT_SESSION_TITLE, createdAt: now, updatedAt: now }
}

/** Builds a short session title from the first user message. */
export function titleFromMessage(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim()
  if (!cleaned) return DEFAULT_SESSION_TITLE
  return cleaned.length > 40 ? `${cleaned.slice(0, 40)}…` : cleaned
}

/** Removes all persisted storage for a session's key namespaces. */
export function purgeSessionStorage(keys: string[]): void {
  keys.forEach(removeJson)
}
