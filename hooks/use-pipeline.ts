"use client"

import { useCallback, useRef, useState } from "react"
import { parseScenes, type ParsedScene } from "@/lib/pipeline/parse-scenes"
import { useStudioSettings } from "@/hooks/use-studio-settings"
import { useImageLibrary } from "@/hooks/use-image-library"
import { DEFAULT_IMAGE_MODELS, toWireProvider, type ProviderConfig } from "@/lib/store/types"

export type PipelineStage =
  | "idle"
  | "extracting"
  | "review"
  | "generating"
  | "awaiting-confirmation"
  | "video-extraction"
  | "post-processing"
  | "complete"
  | "error"

export type SceneStatus = "pending" | "generating" | "done" | "error"

export interface PipelineScene extends ParsedScene {
  status: SceneStatus
  image?: string
  error?: string
}

export interface PipelineState {
  stage: PipelineStage
  storyboard: string
  scenes: PipelineScene[]
  /** index of the scene currently being generated / awaiting confirmation */
  cursor: number
  videoPrompts: string | null
  postProcessing: string | null
  error: string | null
}

const INITIAL: PipelineState = {
  stage: "idle",
  storyboard: "",
  scenes: [],
  cursor: 0,
  videoPrompts: null,
  postProcessing: null,
  error: null,
}

function resolveAgentProvider(
  settings: ReturnType<typeof useStudioSettings>["settings"],
  agentId: string,
  image = false,
): ProviderConfig | null {
  const agentSettings = settings.agentSettings[agentId]
  const assigned = agentSettings?.providerId
    ? settings.providers.find((p) => p.id === agentSettings.providerId)
    : undefined
  const fallback = settings.defaultProviderId
    ? settings.providers.find((p) => p.id === settings.defaultProviderId)
    : undefined
  let provider: ProviderConfig | null = assigned ?? fallback ?? settings.providers[0] ?? null
  if (provider && image && provider.kind !== "custom") {
    // Custom providers keep their user-configured model; built-in kinds swap
    // to their image-capable default.
    const imageModel = DEFAULT_IMAGE_MODELS[provider.kind]
    if (!imageModel) {
      const capable = settings.providers.find(
        (p) => p.kind === "custom" || DEFAULT_IMAGE_MODELS[p.kind],
      )
      provider = capable
        ? capable.kind === "custom"
          ? capable
          : { ...capable, model: DEFAULT_IMAGE_MODELS[capable.kind] }
        : null
    } else {
      provider = { ...provider, model: imageModel }
    }
  }
  return provider
}

async function runAgent(
  agentId: string,
  input: string,
  provider: ProviderConfig,
  instructions: string,
): Promise<string> {
  const res = await fetch("/api/agent-run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId,
      input,
      provider: toWireProvider(provider),
      instructions,
    }),
  })
  const data = (await res.json()) as { text?: string; error?: string }
  if (!res.ok || !data.text) throw new Error(data.error || `${agentId} run failed`)
  return data.text
}

export function usePipeline() {
  const { settings } = useStudioSettings()
  const { add } = useImageLibrary()
  const [state, _setState] = useState<PipelineState>(INITIAL)
  const stateRef = useRef<PipelineState>(INITIAL)
  const cancelled = useRef(false)

  /** Keeps a synchronous mirror of state for async orchestration loops */
  const setState = useCallback((update: PipelineState | ((s: PipelineState) => PipelineState)) => {
    const next = typeof update === "function" ? update(stateRef.current) : update
    stateRef.current = next
    _setState(next)
  }, [])

  const reset = useCallback(() => {
    cancelled.current = true
    setState(INITIAL)
  }, [])

  /** Stage 1: run the Image Prompt Extractor over the storyboard */
  const start = useCallback(
    async (storyboard: string) => {
      cancelled.current = false
      const provider = resolveAgentProvider(settings, "image-prompt-extractor")
      if (!provider) {
        setState({ ...INITIAL, storyboard, stage: "error", error: "No AI provider configured. Add one in Settings." })
        return
      }
      setState({ ...INITIAL, storyboard, stage: "extracting" })
      try {
        const output = await runAgent(
          "image-prompt-extractor",
          storyboard,
          provider,
          settings.agentSettings["image-prompt-extractor"]?.instructions ?? "",
        )
        if (cancelled.current) return
        const parsed = parseScenes(output)
        if (parsed.length === 0) {
          setState((s) => ({
            ...s,
            stage: "error",
            error: "No scenes were detected in the extractor output. Check that the storyboard contains scenes.",
          }))
          return
        }
        setState((s) => ({
          ...s,
          stage: "review",
          scenes: parsed.map((scene) => ({ ...scene, status: "pending" as const })),
        }))
      } catch (error) {
        if (cancelled.current) return
        const message = error instanceof Error ? error.message : "Extraction failed"
        setState((s) => ({ ...s, stage: "error", error: message }))
      }
    },
    [settings],
  )

  /** Stage 2: generate the image for the scene at `index`, honoring continuity */
  const generateScene = useCallback(
    async (index: number, scenes: PipelineScene[]) => {
      const provider = resolveAgentProvider(settings, "image-generator", true)
      if (!provider) {
        setState((s) => ({ ...s, stage: "error", error: "No image-capable provider configured." }))
        return null
      }
      const scene = scenes[index]
      const prompt = scene.imagePrompt ?? scene.body
      const previous = index > 0 ? scenes[index - 1]?.image : undefined
      const referenceImages = [
        ...settings.referenceImages.map((r) => r.dataUrl),
        ...(previous ? [previous] : []),
      ].slice(0, 8)

      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
        provider: toWireProvider(provider),
        instructions: settings.agentSettings["image-generator"]?.instructions ?? "",
          referenceImages,
        }),
      })
      const data = (await res.json()) as { image?: string; error?: string }
      if (!res.ok || !data.image) throw new Error(data.error || "Image generation failed")

      await add({
        id: crypto.randomUUID(),
        dataUrl: data.image,
        prompt,
        sceneIndex: scene.index,
        sceneTitle: scene.title,
        model: provider.model,
        createdAt: Date.now(),
      })
      return data.image
    },
    [settings, add],
  )

  /** Runs image generation from scene `from`, pausing per confirmation mode */
  const runImages = useCallback(
    async (from: number) => {
      cancelled.current = false
      setState((s) => ({ ...s, stage: "generating", cursor: from }))
      let scenes = stateRef.current.scenes

      for (let i = from; i < scenes.length; i++) {
        if (cancelled.current) return
        setState((s) => ({
          ...s,
          stage: "generating",
          cursor: i,
          scenes: s.scenes.map((sc, j) => (j === i ? { ...sc, status: "generating" } : sc)),
        }))
        try {
          const image = await generateScene(i, scenes)
          if (cancelled.current || !image) return
          scenes = scenes.map((sc, j) => (j === i ? { ...sc, status: "done" as const, image } : sc))
          setState((s) => ({ ...s, scenes }))
        } catch (error) {
          const message = error instanceof Error ? error.message : "Image generation failed"
          scenes = scenes.map((sc, j) => (j === i ? { ...sc, status: "error" as const, error: message } : sc))
          setState((s) => ({ ...s, scenes, stage: "awaiting-confirmation", cursor: i }))
          return
        }

        const isLast = i === scenes.length - 1
        if (isLast) {
          setState((s) => ({ ...s, stage: "awaiting-confirmation", cursor: i + 1 }))
          return
        }
        if (!settings.autoContinue) {
          setState((s) => ({ ...s, stage: "awaiting-confirmation", cursor: i + 1 }))
          return
        }
      }
    },
    [generateScene, settings.autoContinue],
  )

  /** Stage 3 + 4: video prompt extraction, then post-processing */
  const runVideoStage = useCallback(async () => {
    cancelled.current = false
    const videoProvider = resolveAgentProvider(settings, "video-prompt-extractor")
    const postProvider = resolveAgentProvider(settings, "post-processing")
    if (!videoProvider || !postProvider) {
      setState((s) => ({ ...s, stage: "error", error: "No AI provider configured." }))
      return
    }
    setState((s) => ({ ...s, stage: "video-extraction" }))
    try {
      const storyboard = stateRef.current.storyboard

      const videoPrompts = await runAgent(
        "video-prompt-extractor",
        storyboard,
        videoProvider,
        settings.agentSettings["video-prompt-extractor"]?.instructions ?? "",
      )
      if (cancelled.current) return
      setState((s) => ({ ...s, videoPrompts, stage: "post-processing" }))

      const postProcessing = await runAgent(
        "post-processing",
        storyboard,
        postProvider,
        settings.agentSettings["post-processing"]?.instructions ?? "",
      )
      if (cancelled.current) return
      setState((s) => ({ ...s, postProcessing, stage: "complete" }))
    } catch (error) {
      if (cancelled.current) return
      const message = error instanceof Error ? error.message : "Video stage failed"
      setState((s) => ({ ...s, stage: "error", error: message }))
    }
  }, [settings])

  /** Retry the scene the pipeline stopped on */
  const retryScene = useCallback(
    (index: number) => {
      setState((s) => ({
        ...s,
        scenes: s.scenes.map((sc, j) => (j === index ? { ...sc, status: "pending", error: undefined } : sc)),
      }))
      void runImages(index)
    },
    [runImages],
  )

  return { state, start, runImages, runVideoStage, retryScene, reset }
}
