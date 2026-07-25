import { PipelineBoard } from "@/components/pipeline/pipeline-board"

export const metadata = { title: "Pipeline" }

export default function PipelinePage() {
  return (
    <main className="min-h-svh">
      <PipelineBoard />
    </main>
  )
}
