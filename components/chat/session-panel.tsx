"use client"

import { useEffect, useRef, useState } from "react"
import { PlusIcon, TrashIcon, PencilSimpleIcon, CheckIcon, XIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ChatSession } from "@/lib/store/session-store"

interface SessionPanelProps {
  sessions: ChatSession[]
  activeId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onRename: (id: string, title: string) => void
  onRemove: (id: string) => void
}

export function SessionPanel({
  sessions,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onRemove,
}: SessionPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId) inputRef.current?.focus()
  }, [editingId])

  function startEdit(session: ChatSession) {
    setEditingId(session.id)
    setDraft(session.title)
  }

  function commitEdit() {
    if (editingId) onRename(editingId, draft)
    setEditingId(null)
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l bg-background">
      <div className="flex items-center justify-between px-4 py-4">
        <h2 className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">Chats</h2>
        <Button size="sm" variant="outline" onClick={onCreate} className="h-8 gap-1.5">
          <PlusIcon className="size-3.5" weight="bold" aria-hidden />
          New chat
        </Button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4" aria-label="Chat sessions">
        <ul className="flex flex-col gap-1">
          {sessions.map((session) => {
            const isActive = session.id === activeId
            const isEditing = session.id === editingId
            return (
              <li key={session.id}>
                {isEditing ? (
                  <div className="flex items-center gap-1 rounded-md border border-ring bg-card px-2 py-1.5">
                    <input
                      ref={inputRef}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                          e.preventDefault()
                          commitEdit()
                        } else if (e.key === "Escape") {
                          setEditingId(null)
                        }
                      }}
                      className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
                      aria-label="Rename chat"
                    />
                    <button
                      type="button"
                      onClick={commitEdit}
                      aria-label="Save name"
                      className="rounded p-1 text-muted-foreground hover:text-foreground"
                    >
                      <CheckIcon className="size-3.5" weight="bold" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      aria-label="Cancel rename"
                      className="rounded p-1 text-muted-foreground hover:text-foreground"
                    >
                      <XIcon className="size-3.5" weight="bold" aria-hidden />
                    </button>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "group flex items-center gap-1 rounded-md px-2 py-1.5 transition-colors",
                      isActive ? "bg-secondary" : "hover:bg-secondary/60",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(session.id)}
                      className="min-w-0 flex-1 text-left"
                      aria-current={isActive ? "true" : undefined}
                    >
                      <span
                        className={cn(
                          "block truncate text-sm",
                          isActive ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {session.title}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(session)}
                      aria-label={`Rename ${session.title}`}
                      className="rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
                    >
                      <PencilSimpleIcon className="size-3.5" weight="bold" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(session.id)}
                      aria-label={`Delete ${session.title}`}
                      className="rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-pastel-red-foreground focus-visible:opacity-100"
                    >
                      <TrashIcon className="size-3.5" weight="bold" aria-hidden />
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
