import { notFound } from "next/navigation"
import { getAgent, AGENTS } from "@/lib/agents/registry"
import { loadMasterPrompt } from "@/lib/agents/prompts"
import { Badge } from "@/components/ui/badge"

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

  const masterPrompt = await loadMasterPrompt(agent.id)

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="animate-fade-up">
        <div className="flex items-center gap-3">
          <h1 className="font-serif text-3xl tracking-tight">{agent.name}</h1>
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
        <p className="mt-2 max-w-2xl leading-relaxed text-muted-foreground">{agent.description}</p>
      </div>

      <div className="mt-10 rounded-lg border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Chat interface arrives in a later phase. This agent will open with:
        </p>
        <p className="mt-3 font-serif text-lg italic">&ldquo;{agent.openingLine}&rdquo;</p>
      </div>

      <details className="mt-8 rounded-lg border bg-card">
        <summary className="cursor-pointer px-6 py-4 text-sm font-medium">
          Master prompt <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">{agent.promptFile}</span>
        </summary>
        <pre className="overflow-x-auto border-t px-6 py-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {masterPrompt}
        </pre>
      </details>
    </div>
  )
}
