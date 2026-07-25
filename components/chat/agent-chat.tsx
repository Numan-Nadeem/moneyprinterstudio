"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Streamdown } from "streamdown"
import {
  ArrowUpIcon,
  CopyIcon,
  CheckIcon,
  StopIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useAgentProvider } from "@/hooks/use-agent-provider"
import type { AgentDefinition } from "@/lib/agents/registry"
import { cn } from "@/lib/utils"

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : "Copy message"}
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-secondary hover:text-foreground focus-visible:opacity-100"
    >
      {copied ? (
        <CheckIcon className="size-3.5" weight="bold" aria-hidden />
      ) : (
        <CopyIcon className="size-3.5" weight="bold" aria-hidden />
      )}
    </button>
  )
}

export function AgentChat({ agent }: { agent: AgentDefinition }) {
  const { provider, instructions } = useAgentProvider(agent.id)
  const [input, setInput] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status, stop, error } = useChat({
    id: `agent-${agent.id}`,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  })

  const busy = status === "submitted" || status === "streaming"

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  function submit() {
    const text = input.trim()
    if (!text || busy || !provider) return
    sendMessage(
      { text },
      {
        body: {
          agentId: agent.id,
          provider: { kind: provider.kind, apiKey: provider.apiKey, model: provider.model },
          instructions,
        },
      },
    )
    setInput("")
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Message list */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
          {messages.length === 0 && (
            <div className="flex flex-col items-start gap-2 rounded-lg border border-border bg-card px-6 py-5">
              <p className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
                {agent.shortName}
              </p>
              <p className="font-serif text-xl tracking-tight text-foreground">{agent.openingLine}</p>
            </div>
          )}

          {messages.map((message) => {
            const text = message.parts
              .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
              .map((p) => p.text)
              .join("")
            const isUser = message.role === "user"
            return (
              <div key={message.id} className={cn("group flex flex-col gap-1", isUser && "items-end")}>
                {isUser ? (
                  <div className="max-w-[85%] rounded-lg bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground whitespace-pre-wrap">
                    {text}
                  </div>
                ) : (
                  <div className="w-full">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
                        {agent.shortName}
                      </p>
                      <CopyButton text={text} />
                    </div>
                    <div className="prose-sm mt-1.5 max-w-none text-sm leading-relaxed text-foreground">
                      <Streamdown>{text}</Streamdown>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {status === "submitted" && (
            <p className="font-mono text-xs text-muted-foreground" role="status">
              Thinking…
            </p>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md bg-pastel-red px-4 py-3 text-sm text-pastel-red-foreground"
            >
              <WarningCircleIcon className="mt-0.5 size-4 shrink-0" weight="bold" aria-hidden />
              <span>{error.message || "Something went wrong. Check your provider settings."}</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="border-t bg-background">
        <div className="mx-auto w-full max-w-3xl px-6 py-4">
          {!provider ? (
            <p className="rounded-md bg-pastel-yellow px-4 py-3 text-sm text-pastel-yellow-foreground">
              No AI provider configured.{" "}
              <Link href="/settings" className="font-medium underline underline-offset-2">
                Add one in Settings
              </Link>{" "}
              to start chatting.
            </p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                submit()
              }}
              className="flex items-end gap-2 rounded-lg border border-border bg-card p-2 focus-within:border-ring"
            >
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                    e.preventDefault()
                    submit()
                  }
                }}
                placeholder={agent.openingLine}
                aria-label={`Message ${agent.name}`}
                className="max-h-48 min-h-10 flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                rows={1}
              />
              {busy ? (
                <Button type="button" size="icon" variant="secondary" onClick={() => stop()} aria-label="Stop">
                  <StopIcon className="size-4" weight="fill" aria-hidden />
                </Button>
              ) : (
                <Button type="submit" size="icon" disabled={!input.trim()} aria-label="Send">
                  <ArrowUpIcon className="size-4" weight="bold" aria-hidden />
                </Button>
              )}
            </form>
          )}
          {provider && (
            <p className="mt-2 text-center font-mono text-[10px] tracking-wide text-muted-foreground">
              {provider.label} · {provider.model}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
