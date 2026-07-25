import Link from "next/link"
import { AGENTS } from "@/lib/agents/registry"
import { Badge } from "@/components/ui/badge"

const PIPELINE_STEPS = [
  { step: "01", title: "Write the storyboard", agent: "Storyboard Generator" },
  { step: "02", title: "Extract scene prompts", agent: "Image Prompt Extractor" },
  { step: "03", title: "Generate scene images", agent: "Image Generator" },
  { step: "04", title: "Extract video prompts", agent: "Video Prompt Extractor" },
  { step: "05", title: "Compile post details", agent: "Post Processing" },
]

export default function OverviewPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12 md:py-20">
      <div className="animate-fade-up">
        <p className="font-mono text-xs tracking-[0.1em] text-muted-foreground uppercase">
          Production pipeline
        </p>
        <h1 className="mt-3 max-w-2xl font-serif text-4xl leading-[1.1] tracking-tight text-balance md:text-5xl">
          One idea in. A finished cinematic reel plan out.
        </h1>
        <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
          Five orchestrated agents take a single line of input and produce a
          complete storyboard, scene-by-scene images, video generation prompts,
          and post-production details — with no copy-paste in between.
        </p>
      </div>

      <section className="mt-14" aria-labelledby="pipeline-heading">
        <h2 id="pipeline-heading" className="font-mono text-xs tracking-[0.1em] text-muted-foreground uppercase">
          How it flows
        </h2>
        <ol className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-5">
          {PIPELINE_STEPS.map((s) => (
            <li key={s.step} className="bg-card p-5">
              <span className="font-mono text-xs text-muted-foreground">{s.step}</span>
              <p className="mt-2 text-sm leading-snug font-medium">{s.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.agent}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14" aria-labelledby="agents-heading">
        <div className="flex items-baseline justify-between">
          <h2 id="agents-heading" className="font-mono text-xs tracking-[0.1em] text-muted-foreground uppercase">
            The five agents
          </h2>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {AGENTS.map((agent, i) => (
            <Link
              key={agent.id}
              href={`/agents/${agent.id}`}
              className={`group rounded-lg border bg-card p-6 transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] ${
                i === 0 ? "md:col-span-2" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-medium tracking-tight">{agent.name}</h3>
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
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {agent.description}
              </p>
              <p className="mt-4 font-mono text-xs text-muted-foreground">
                {agent.promptFile}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
