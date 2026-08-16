"use client"

import { useCallback, useEffect, useState } from "react"
import {
  DEFAULT_SESSION_TITLE,
  loadActiveSessionId,
  loadSessions,
  newSession,
  saveActiveSessionId,
  saveSessions,
  titleFromMessage,
  type ChatSession,
} from "@/lib/store/session-store"

interface UseAgentSessions {
  sessions: ChatSession[]
  activeId: string | null
  select: (id: string) => void
  create: () => void
  rename: (id: string, title: string) => void
  remove: (id: string) => void
  /** Sets a session's title from its first message, if still untitled. */
  titleFromFirstMessage: (id: string, text: string) => void
  ready: boolean
}

/**
 * Manages the per-agent list of chat sessions and the active selection,
 * persisted to localStorage. A single instance lives in the agent workspace
 * and is shared with both the chat view and the session panel.
 */
export function useAgentSessions(agentId: string): UseAgentSessions {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  // Hydrate from storage once per agent; seed a first session if none exist.
  useEffect(() => {
    let loaded = loadSessions(agentId)
    let active = loadActiveSessionId(agentId)
    if (loaded.length === 0) {
      const first = newSession()
      loaded = [first]
      active = first.id
      saveSessions(agentId, loaded)
      saveActiveSessionId(agentId, first.id)
    }
    if (!active || !loaded.some((s) => s.id === active)) {
      active = loaded[0].id
      saveActiveSessionId(agentId, active)
    }
    setSessions(loaded)
    setActiveId(active)
    setReady(true)
  }, [agentId])

  const persist = useCallback(
    (next: ChatSession[]) => {
      setSessions(next)
      saveSessions(agentId, next)
    },
    [agentId],
  )

  const select = useCallback(
    (id: string) => {
      setActiveId(id)
      saveActiveSessionId(agentId, id)
    },
    [agentId],
  )

  const create = useCallback(() => {
    const session = newSession()
    persist([session, ...sessions])
    select(session.id)
  }, [persist, select, sessions])

  const rename = useCallback(
    (id: string, title: string) => {
      persist(
        sessions.map((s) =>
          s.id === id ? { ...s, title: title.trim() || DEFAULT_SESSION_TITLE, updatedAt: Date.now() } : s,
        ),
      )
    },
    [persist, sessions],
  )

  const remove = useCallback(
    (id: string) => {
      const remaining = sessions.filter((s) => s.id !== id)
      // Never leave the agent with zero sessions.
      const next = remaining.length > 0 ? remaining : [newSession()]
      persist(next)
      if (activeId === id) select(next[0].id)
    },
    [activeId, persist, select, sessions],
  )

  const titleFromFirstMessage = useCallback(
    (id: string, text: string) => {
      setSessions((prev) => {
        const target = prev.find((s) => s.id === id)
        if (!target || target.title !== DEFAULT_SESSION_TITLE) return prev
        const next = prev.map((s) =>
          s.id === id ? { ...s, title: titleFromMessage(text), updatedAt: Date.now() } : s,
        )
        saveSessions(agentId, next)
        return next
      })
    },
    [agentId],
  )

  return { sessions, activeId, select, create, rename, remove, titleFromFirstMessage, ready }
}
