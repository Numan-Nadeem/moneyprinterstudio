import { generateImage, generateText, type ModelMessage } from "ai"
import { z } from "zod"
import { buildSystemPrompt } from "@/lib/agents/prompts"
import { resolveLanguageModel, type WireProviderConfig } from "@/lib/ai/resolve-model"
import { createGateway } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"

export const maxDuration = 300

const bodySchema = z.object({
  prompt: z.string().min(1),
  provider: z.object({
    kind: z.enum(["gateway", "openai", "anthropic", "google"]),
    apiKey: z.string().min(1),
    model: z.string().min(1),
  }),
  instructions: z.string().optional(),
  /** Character reference images + previous scene image, as data URLs */
  referenceImages: z.array(z.string()).max(8).optional(),
})

/** Pure image models have no chat interface; multimodal LLMs do. */
function isPureImageModel(model: string): boolean {
  const id = model.toLowerCase()
  return id.includes("gpt-image") || id.includes("dall-e") || id.includes("imagen") || id.includes("grok-imagine")
}

function resolveImageModel(config: WireProviderConfig) {
  const { kind, apiKey, model } = config
  switch (kind) {
    case "gateway":
      return createGateway({ apiKey }).imageModel(model)
    case "openai":
      return createOpenAI({ apiKey }).imageModel(model)
    case "google":
      return createGoogleGenerativeAI({ apiKey }).imageModel(model)
    default:
      throw new Error("This provider does not support image models")
  }
}

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  }
  const { prompt, provider, instructions, referenceImages = [] } = parsed.data

  try {
    if (isPureImageModel(provider.model)) {
      // Pure image model: no system prompt support; send the scene prompt directly.
      const { image } = await generateImage({
        model: resolveImageModel(provider),
        prompt,
        aspectRatio: "9:16",
      })
      return Response.json({
        image: `data:${image.mediaType};base64,${image.base64}`,
        text: null,
      })
    }

    // Multimodal LLM path: master prompt as system, reference images as inputs.
    const system = await buildSystemPrompt("image-generator", instructions)
    const content: Exclude<ModelMessage & { role: "user" }, string>["content"] = [
      ...referenceImages.map((dataUrl) => ({ type: "image" as const, image: dataUrl })),
      { type: "text" as const, text: prompt },
    ]

    const result = await generateText({
      model: resolveLanguageModel(provider),
      instructions: system,
      messages: [{ role: "user", content }],
    })

    const imageFile = result.files.find((f) => f.mediaType.startsWith("image/"))
    if (!imageFile) {
      return Response.json(
        { error: "The model did not return an image. Use an image-capable model (e.g. a Gemini image model).", text: result.text || null },
        { status: 422 },
      )
    }

    return Response.json({
      image: `data:${imageFile.mediaType};base64,${imageFile.base64}`,
      text: result.text || null,
    })
  } catch (error) {
    console.error("[generate-image] error:", error)
    const message = error instanceof Error ? error.message : "Image generation failed"
    return Response.json({ error: message }, { status: 502 })
  }
}
