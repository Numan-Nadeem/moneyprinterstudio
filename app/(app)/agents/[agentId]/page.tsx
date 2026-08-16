import { notFound } from "next/navigation"
import { getAgent, AGENTS } from "@/lib/agents/registry"
import { Badge } from "@/components/ui/badge"
import { AgentWorkspace } from "@/components/chat/agent-workspace"

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
        <div className="flex w-full items-center gap-3 px-6 py-4">
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
        <AgentWorkspace agent={agent} />
      </div>
    </div>
  )
}
