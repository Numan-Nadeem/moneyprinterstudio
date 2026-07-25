import { notFound } from "next/navigation"
import { getAgent, AGENTS } from "@/lib/agents/registry"
import { Badge } from "@/components/ui/badge"
import { AgentChat } from "@/components/chat/agent-chat"
import { ImageChat } from "@/components/chat/image-chat"

export function generateStaticParams() {
  return AGENTS.map((agent) => ({ agentId: agent.id }))
}

export default async function AgentPage({
  params,
}: {
  params: Promise<{ agentId: string }>
}) {
  const { agentId } = await params
  const agent = getAgent(agentId)
  if (!agent) notFound()

  return (
    <div className="flex h-svh min-h-0 flex-col">
      <header className="shrink-0 border-b bg-background">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-6 py-4">
          <h1 className="font-serif text-xl tracking-tight">{agent.name}</h1>
          <Badge
            className={
              agent.type === "image"
                ? "rounded-full bg-pastel-blue text-[10px] tracking-[0.05em] text-pastel-blue-foreground uppercase"
                : "rounded-full bg-pastel-green text-[10px] tracking-[0.05em] text-pastel-green-foreground uppercase"
            }
          >
            {agent.type === "image" ? "Image model" : "Text model"}
          </Badge>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        {agent.type === "image" ? <ImageChat agent={agent} /> : <AgentChat agent={agent} />}
      </div>
    </div>
  )
}
