"use client"

import { Chat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { chatKey, loadJson, removeJson, saveJson } from "@/lib/store/chat-store"

/**
 * Module-scope registry of Chat instances, keyed per (agent, session).
 *
 * Each session is a completely separate conversation with its own message
 * history, so a streaming request only ever carries the CURRENT session's
 * context — no other chat's memory leaks in. Instances live outside React so
 * an in-flight stream keeps going across tab navigation and is restored on
 * return. Messages are mirrored to localStorage to survive full reloads.
 */
const registry = new Map<string, Chat<UIMessage>>()

const registryKey = (agentId: string, sessionId: string) => `${agentId}::${sessionId}`

export function getAgentChat(agentId: string, sessionId: string): Chat<UIMessage> {
  const key = registryKey(agentId, sessionId)
  const existing = registry.get(key)
  if (existing) return existing

  const chat = new Chat<UIMessage>({
    id: `agent-${agentId}-${sessionId}`,
    messages: loadJson<UIMessage[]>(chatKey(agentId, sessionId)) ?? [],
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onFinish: () => {
      saveJson(chatKey(agentId, sessionId), chat.messages)
    },
  })
  registry.set(key, chat)
  return chat
}

/** Clears one session's conversation everywhere (memory + storage). */
export function clearAgentChat(agentId: string, sessionId: string) {
  const chat = registry.get(registryKey(agentId, sessionId))
  if (chat) chat.messages = []
  saveJson(chatKey(agentId, sessionId), [])
}

/** Removes a session entirely: drops its instance and its stored messages. */
export function deleteAgentChat(agentId: string, sessionId: string) {
  registry.delete(registryKey(agentId, sessionId))
  removeJson(chatKey(agentId, sessionId))
}
