import "server-only"
import { createGateway } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import type { LanguageModel } from "ai"
import { z } from "zod"

/** Wire schema for BYOK provider configs sent per-request from the client. */
export const wireProviderSchema = z
  .object({
    kind: z.enum(["gateway", "openai", "anthropic", "google", "custom"]),
    apiKey: z.string(),
    model: z.string().min(1),
    baseUrl: z.string().url().optional(),
    headers: z.record(z.string(), z.string()).optional(),
  })
  .refine((p) => (p.kind === "custom" ? Boolean(p.baseUrl) : p.apiKey.length > 0), {
    message: "API key is required (custom providers require a base URL instead)",
  })

export type WireProviderConfig = z.infer<typeof wireProviderSchema>

/** OpenAI-compatible client for custom providers (baseURL + optional headers). */
export function createCustomOpenAICompatible(config: WireProviderConfig) {
  if (!config.baseUrl) {
    throw new Error("Custom provider requires a base URL")
  }
  return createOpenAI({
    // Some OpenAI-compatible servers reject requests without an auth header;
    // when auth is handled via custom headers, pass a placeholder key.
    apiKey: config.apiKey || "none",
    baseURL: config.baseUrl,
    headers: config.headers,
  })
}

/**
 * Resolves a provider config into an ordered list of language model
 * candidates. For custom OpenAI-compatible proxies, different models may be
 * served through different endpoint formats — some only via Chat Completions
 * (/v1/chat/completions), others only via the Responses API (/v1/responses).
 * Callers should try each candidate in order and fall back on API errors.
 */
export function resolveLanguageModelCandidates(config: WireProviderConfig): LanguageModel[] {
  if (config.kind === "custom") {
    const factory = createCustomOpenAICompatible(config)
    return [factory.chat(config.model), factory.responses(config.model)]
  }
  return [resolveLanguageModel(config)]
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
    case "custom":
      // Use Chat Completions (/v1/chat/completions) explicitly. The default
      // factory targets the OpenAI Responses API (/v1/responses), which most
      // OpenAI-compatible proxies do not support or route incorrectly.
      return createCustomOpenAICompatible(config).chat(model)
    default:
      throw new Error(`Unsupported provider kind: ${kind satisfies never}`)
  }
}
