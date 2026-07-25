"use client"

import { Chat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { chatKey, loadJson, saveJson } from "@/lib/store/chat-store"

/**
 * Module-scope registry of Chat instances, one per agent.
 *
 * Because instances live outside React, an in-flight streaming response
 * keeps going when the user navigates to another tab, and the full
 * conversation is still there (with the completed reply) when they return.
 * Messages are also mirrored to localStorage so chats survive full reloads.
 */
const registry = new Map<string, Chat<UIMessage>>()

export function getAgentChat(agentId: string): Chat<UIMessage> {
  const existing = registry.get(agentId)
  if (existing) return existing

  const chat = new Chat<UIMessage>({
    id: `agent-${agentId}`,
    messages: loadJson<UIMessage[]>(chatKey(agentId)) ?? [],
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onFinish: () => {
      saveJson(chatKey(agentId), chat.messages)
    },
  })
  registry.set(agentId, chat)
  return chat
}

/** Clears an agent's conversation everywhere (memory + storage). */
export function clearAgentChat(agentId: string) {
  const chat = registry.get(agentId)
  if (chat) chat.messages = []
  saveJson(chatKey(agentId), [])
}
