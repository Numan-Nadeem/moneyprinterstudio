import { z } from "zod"

/**
 * Probes a custom OpenAI-compatible provider model-by-model.
 *
 * Gateways like new-api map each model ID to an upstream "channel". When an ID
 * is not mapped to a channel that has credentials, the gateway silently
 * reroutes it (e.g. to a "codex" channel) and returns errors such as
 * `auth_not_found: no auth available (providers=codex, model=...)` that name a
 * model the app never sent. The only reliable way to know which IDs actually
 * work is to send a minimal real completion for each one.
 */
const bodySchema = z.object({
  baseUrl: z.string().min(1),
  apiKey: z.string().optional().default(""),
  headers: z.record(z.string(), z.string()).optional(),
  models: z.array(z.string().min(1)).min(1).max(40),
})

export type ProbeFormat = "chat" | "responses" | "images"

export interface ProbeResult {
  model: string
  ok: boolean
  /** Endpoint format that succeeded, when ok */
  format?: ProbeFormat
  status?: number
  error?: string
  /** True when the gateway reported a different model than the one sent */
  rerouted?: boolean
}

function authHeaders(apiKey: string, extra?: Record<string, string>) {
  return {
    "Content-Type": "application/json",
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    ...(extra ?? {}),
  }
}

function extractError(raw: string): string {
  const trimmed = raw.trim()
  // A gateway that returns HTML is not an OpenAI-compatible API endpoint —
  // surfacing raw markup here would be useless noise.
  if (/^<(!doctype|html)/i.test(trimmed)) {
    return "The base URL returned an HTML page, not an API response. Check that it points at the API root (usually ending in /v1)."
  }
  if (!trimmed) return "Empty response from the provider."
  try {
    const parsed = JSON.parse(trimmed) as {
      error?: { message?: string } | string
      message?: string
    }
    if (typeof parsed.error === "string") return parsed.error
    const message = parsed.error?.message ?? parsed.message
    if (message) return message
    return trimmed.slice(0, 200)
  } catch {
    return trimmed.slice(0, 200)
  }
}

async function probeModel(
  base: string,
  headers: Record<string, string>,
  model: string,
): Promise<ProbeResult> {
  const attempts: { format: ProbeFormat; path: string; body: unknown }[] = [
    {
      format: "chat",
      path: "/chat/completions",
      body: { model, messages: [{ role: "user", content: "hi" }], max_tokens: 1 },
    },
    { format: "responses", path: "/responses", body: { model, input: "hi", max_output_tokens: 16 } },
    {
      format: "images",
      path: "/images/generations",
      body: { model, prompt: "a red dot", n: 1 },
    },
  ]

  // Track the most diagnostic failure rather than the last one: a 404 from an
  // unsupported endpoint format says nothing, while an upstream auth/channel
  // error explains why the model cannot be served.
  let best: ProbeResult | null = null
  const rank = (r: ProbeResult) => (r.status === 404 ? 0 : r.rerouted ? 3 : 2)

  for (const attempt of attempts) {
    try {
      const res = await fetch(`${base}${attempt.path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(attempt.body),
        signal: AbortSignal.timeout(30_000),
      })
      const raw = await res.text()
      if (res.ok) return { model, ok: true, format: attempt.format, status: res.status }

      const message = extractError(raw)
      const reported = /model=([^\s),]+)/.exec(message)?.[1]
      const candidate: ProbeResult = {
        model,
        ok: false,
        status: res.status,
        error: message,
        rerouted: Boolean(reported && reported !== model),
      }
      if (!best || rank(candidate) > rank(best)) best = candidate
    } catch (error) {
      const candidate: ProbeResult = {
        model,
        ok: false,
        error: error instanceof Error ? error.message : "Request failed",
      }
      if (!best) best = candidate
    }
  }

  return best ?? { model, ok: false, error: "No response" }
}

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return Response.json({ error: "Invalid probe request" }, { status: 400 })
  }
  const { baseUrl, apiKey, headers: extra, models } = parsed.data
  const base = baseUrl.replace(/\/+$/, "")
  const headers = authHeaders(apiKey, extra)

  const results: ProbeResult[] = []
  // Sequential: gateways commonly rate-limit parallel probe bursts.
  for (const model of models) {
    results.push(await probeModel(base, headers, model))
  }

  return Response.json({ results })
}
