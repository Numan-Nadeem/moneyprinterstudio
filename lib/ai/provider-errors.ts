/**
 * Translates raw provider/proxy errors into actionable guidance.
 *
 * OpenAI-compatible gateways (new-api, one-api, LiteLLM, OpenRouter, …) route
 * each model ID to an upstream "channel". When the requested ID is unknown or
 * the channel behind it has no credentials, the gateway returns a low-level
 * error that mentions an upstream provider pool and a model name the user
 * never selected — which reads like an app bug but is really a routing or
 * entitlement problem on the gateway side.
 */
export function explainProviderError(error: unknown, requestedModel?: string): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : ""
  if (!raw) return "The provider returned an error. Check your API key and model."

  const lower = raw.toLowerCase()
  const asked = requestedModel ? `"${requestedModel}"` : "the selected model"

  // Gateway has no upstream credential for the channel this model maps to.
  // e.g. `auth_not_found: no auth available (providers=codex, model=gpt-5.5)`
  if (lower.includes("auth_not_found") || lower.includes("no auth available")) {
    const pool = /providers=([\w.-]+)/i.exec(raw)?.[1]
    const upstream = /model=([\w.\-:/]+)/i.exec(raw)?.[1]
    return [
      `Your proxy accepted the key but has no upstream credentials for ${asked}.`,
      pool ? ` It routed the request to its "${pool}" channel` : " It routed the request to a channel",
      upstream && upstream !== requestedModel ? ` and resolved it to "${upstream}"` : "",
      `, which has no auth configured. This is a proxy-side routing issue, not a key problem —`,
      ` other models on the same key still work.`,
      ` Fix: open Settings, click "Sync models" on the provider, and pick a model from the real list.`,
    ].join("")
  }

  // Unknown / unavailable model ID.
  if (
    lower.includes("model_not_found") ||
    lower.includes("no such model") ||
    lower.includes("model not found") ||
    lower.includes("invalid model") ||
    lower.includes("unsupported model")
  ) {
    return `The provider does not serve ${asked}. Open Settings, click "Sync models" on the provider, and choose a model from the fetched list.`
  }

  // Bad or missing token.
  if (
    lower.includes("invalid token") ||
    lower.includes("invalid_api_key") ||
    lower.includes("incorrect api key") ||
    lower.includes("unauthorized") ||
    lower.includes("401")
  ) {
    return "The provider rejected your API key. Re-enter the key for this provider in Settings."
  }

  if (lower.includes("insufficient") || lower.includes("quota") || lower.includes("balance")) {
    return "The provider reported insufficient quota or balance for this key."
  }

  if (lower.includes("rate limit") || lower.includes("429")) {
    return "The provider rate-limited this request. Wait a moment and try again."
  }

  if (lower.includes("timeout") || lower.includes("aborted") || lower.includes("fetch failed")) {
    return "Could not reach the provider. Check the base URL in Settings and try again."
  }

  return raw
}
