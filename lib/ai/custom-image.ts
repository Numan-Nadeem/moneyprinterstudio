import "server-only"
import type { WireProviderConfig } from "@/lib/ai/resolve-model"

/**
 * Image generation for custom OpenAI-compatible providers.
 *
 * Proxies expose image models in two formats:
 *  1. Chat Completions (`/v1/chat/completions`) — multimodal LLMs (e.g.
 *     Gemini image models relayed in OpenAI chat format) return images in
 *     the response message (`message.images[]`, content parts, or inline
 *     data URLs). The AI SDK does not parse these, so we call the endpoint
 *     directly.
 *  2. Images API (`/v1/images/generations`) — pure image models (DALL-E,
 *     gpt-image, flux, etc.) return `data[].b64_json` or `data[].url`.
 *
 * We try chat completions first (works for multimodal models and carries
 * the system prompt + reference images), then fall back to the Images API.
 */

export interface CustomImageResult {
  /** data URL of the generated image */
  image: string | null
  /** any text the model returned alongside (or instead of) the image */
  text: string | null
}

function endpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path}`
}

function authHeaders(config: WireProviderConfig): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    ...config.headers,
  }
}

/** Extracts an image data URL from the many shapes proxies return. */
function extractImageFromChatMessage(message: unknown): string | null {
  if (!message || typeof message !== "object") return null
  const msg = message as Record<string, unknown>

  // OpenRouter / Gemini-relay style: message.images[].image_url.url
  if (Array.isArray(msg.images) && msg.images.length > 0) {
    const first = msg.images[0] as Record<string, unknown>
    const imageUrl = (first?.image_url as Record<string, unknown>)?.url ?? first?.url
    if (typeof imageUrl === "string" && imageUrl.length > 0) return imageUrl
  }

  // Content as parts array: [{ type: "image_url", image_url: { url } }, ...]
  if (Array.isArray(msg.content)) {
    for (const part of msg.content as Array<Record<string, unknown>>) {
      if (part?.type === "image_url") {
        const url = (part.image_url as Record<string, unknown>)?.url
        if (typeof url === "string" && url.length > 0) return url
      }
    }
  }

  // Inline data URL inside a string content (markdown or raw)
  if (typeof msg.content === "string") {
    const match = msg.content.match(/data:image\/[a-z+.-]+;base64,[A-Za-z0-9+/=]+/)
    if (match) return match[0]
  }

  return null
}

function extractTextFromChatMessage(message: unknown): string | null {
  if (!message || typeof message !== "object") return null
  const msg = message as Record<string, unknown>
  if (typeof msg.content === "string") {
    // Strip any inline image data URLs from the text
    const text = msg.content.replace(/data:image\/[a-z+.-]+;base64,[A-Za-z0-9+/=]+/g, "").trim()
    return text || null
  }
  if (Array.isArray(msg.content)) {
    const texts = (msg.content as Array<Record<string, unknown>>)
      .filter((p) => p?.type === "text" && typeof p.text === "string")
      .map((p) => p.text as string)
    const joined = texts.join("\n").trim()
    return joined || null
  }
  return null
}

/** Chat Completions format with image output (multimodal LLM relays). */
async function tryChatCompletions(
  config: WireProviderConfig,
  system: string,
  prompt: string,
  referenceImages: string[],
): Promise<CustomImageResult & { ok: boolean; error?: string }> {
  const userContent: Array<Record<string, unknown>> =
    referenceImages.length > 0
      ? [
          ...referenceImages.map((url) => ({ type: "image_url", image_url: { url } })),
          { type: "text", text: prompt },
        ]
      : [{ type: "text", text: prompt }]

  const body: Record<string, unknown> = {
    model: config.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
    // OpenRouter-style hint that image output is expected; removed on retry
    // if the server rejects unknown fields.
    modalities: ["image", "text"],
  }

  let res = await fetch(endpoint(config.baseUrl!, "/chat/completions"), {
    method: "POST",
    headers: authHeaders(config),
    body: JSON.stringify(body),
  })

  if (!res.ok && res.status === 400) {
    // Retry without the modalities hint for stricter servers
    delete body.modalities
    res = await fetch(endpoint(config.baseUrl!, "/chat/completions"), {
      method: "POST",
      headers: authHeaders(config),
      body: JSON.stringify(body),
    })
  }

  if (!res.ok) {
    const errText = (await res.text().catch(() => "")).slice(0, 300)
    return { ok: false, image: null, text: null, error: `chat/completions ${res.status}: ${errText}` }
  }

  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
  const choices = data?.choices as Array<Record<string, unknown>> | undefined
  const message = choices?.[0]?.message
  return {
    ok: true,
    image: extractImageFromChatMessage(message),
    text: extractTextFromChatMessage(message),
  }
}

/** OpenAI Images API format (pure image models). */
async function tryImagesGenerations(
  config: WireProviderConfig,
  prompt: string,
): Promise<CustomImageResult & { ok: boolean; error?: string }> {
  const res = await fetch(endpoint(config.baseUrl!, "/images/generations"), {
    method: "POST",
    headers: authHeaders(config),
    body: JSON.stringify({
      model: config.model,
      prompt,
      n: 1,
      response_format: "b64_json",
    }),
  })

  if (!res.ok) {
    const errText = (await res.text().catch(() => "")).slice(0, 300)
    return { ok: false, image: null, text: null, error: `images/generations ${res.status}: ${errText}` }
  }

  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
  const items = data?.data as Array<Record<string, unknown>> | undefined
  const first = items?.[0]
  if (typeof first?.b64_json === "string") {
    return { ok: true, image: `data:image/png;base64,${first.b64_json}`, text: null }
  }
  if (typeof first?.url === "string") {
    return { ok: true, image: first.url, text: null }
  }
  return { ok: false, image: null, text: null, error: "images/generations returned no image data" }
}

/** Heuristic: models served by the Images API rather than chat completions. */
function prefersImagesApi(model: string): boolean {
  const id = model.toLowerCase()
  return (
    id.includes("gpt-image") ||
    id.includes("dall-e") ||
    id.includes("imagen") ||
    id.includes("grok-imagine") ||
    id.includes("flux") ||
    id.includes("stable-diffusion") ||
    id.startsWith("sd")
  )
}

/**
 * Generates an image via a custom OpenAI-compatible proxy, choosing the
 * proper endpoint format and falling back to the other on failure.
 */
export async function generateCustomProviderImage(
  config: WireProviderConfig,
  system: string,
  prompt: string,
  referenceImages: string[],
): Promise<CustomImageResult> {
  const attempts = prefersImagesApi(config.model)
    ? ([tryImagesGenerations, tryChatCompletions] as const)
    : ([tryChatCompletions, tryImagesGenerations] as const)

  const errors: string[] = []
  let lastText: string | null = null

  for (const attempt of attempts) {
    const result =
      attempt === tryImagesGenerations
        ? await tryImagesGenerations(config, prompt)
        : await tryChatCompletions(config, system, prompt, referenceImages)

    if (result.image) return { image: result.image, text: result.text }
    if (result.text) lastText = result.text
    if (result.error) errors.push(result.error)
  }

  if (lastText) return { image: null, text: lastText }
  throw new Error(errors.join(" | ") || "Custom provider returned no image")
}
