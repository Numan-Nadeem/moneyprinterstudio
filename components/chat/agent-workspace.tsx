"use client"

import { AgentChat } from "@/components/chat/agent-chat"
import { ImageChat } from "@/components/chat/image-chat"
import { SessionPanel } from "@/components/chat/session-panel"
import { useAgentSessions } from "@/hooks/use-agent-sessions"
import { deleteAgentChat } from "@/lib/store/chat-registry"
import { imageChatKey } from "@/lib/store/chat-store"
import { purgeSessionStorage } from "@/lib/store/session-store"
import type { AgentDefinition } from "@/lib/agents/registry"

/**
 * Client shell for an agent page. Owns the per-agent session list and the
 * active selection, rendering the active session's conversation on the left
 * and the session switcher on the right. Each session is fully isolated —
 * switching remounts the chat (via `key`) so only the current session's
 * context and memory are ever loaded.
 */
export function AgentWorkspace({ agent }: { agent: AgentDefinition }) {
  const { sessions, activeId, select, create, rename, remove, titleFromFirstMessage, ready } =
    useAgentSessions(agent.id)

  function handleRemove(id: string) {
    // Clean up the conversation storage/instance for the removed session.
    if (agent.type === "image") {
      purgeSessionStorage([imageChatKey(agent.id, id)])
    } else {
      deleteAgentChat(agent.id, id)
    }
    remove(id)
  }

  if (!ready || !activeId) {
    return <div className="min-h-0 flex-1" />
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="min-h-0 flex-1">
        {agent.type === "image" ? (
          <ImageChat
            key={activeId}
            agent={agent}
            sessionId={activeId}
            onFirstMessage={(text) => titleFromFirstMessage(activeId, text)}
          />
        ) : (
          <AgentChat
            key={activeId}
            agent={agent}
            sessionId={activeId}
            onFirstMessage={(text) => titleFromFirstMessage(activeId, text)}
          />
        )}
      </div>
      <SessionPanel
        sessions={sessions}
        activeId={activeId}
        onSelect={select}
        onCreate={create}
        onRename={rename}
        onRemove={handleRemove}
      />
    </div>
  )
}
