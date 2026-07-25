import "server-only"
import { createGateway } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import type { LanguageModel } from "ai"

export interface WireProviderConfig {
  kind: "gateway" | "openai" | "anthropic" | "google"
  apiKey: string
  model: string
}

/**
 * Resolves a BYOK provider config (sent per-request, never stored server-side)
 * into an AI SDK language model instance.
 */
export function resolveLanguageModel(config: WireProviderConfig): LanguageModel {
  const { kind, apiKey, model } = config
  switch (kind) {
    case "gateway":
      return createGateway({ apiKey })(model)
    case "openai":
      return createOpenAI({ apiKey })(model)
    case "anthropic":
      return createAnthropic({ apiKey })(model)
    case "google":
      return createGoogleGenerativeAI({ apiKey })(model)
    default:
      throw new Error(`Unsupported provider kind: ${kind satisfies never}`)
  }
}
