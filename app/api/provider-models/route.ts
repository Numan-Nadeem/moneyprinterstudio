import { z } from "zod"

const bodySchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
})

/**
 * Lists the models an OpenAI-compatible provider actually serves
 * (GET {baseUrl}/models). Proxied server-side to avoid CORS; the key is
 * passed through per-request and never stored.
 */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  }
  const { baseUrl, apiKey, headers } = parsed.data

  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/models`, {
      headers: {
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...headers,
      },
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      return Response.json(
        { error: `Provider returned ${res.status}: ${text.slice(0, 300)}` },
        { status: 502 },
      )
    }

    const data = (await res.json()) as { data?: Array<{ id?: string }> } | Array<{ id?: string }>
    const list = Array.isArray(data) ? data : (data.data ?? [])
    const models = list
      .map((m) => (typeof m?.id === "string" ? m.id : null))
      .filter((id): id is string => Boolean(id))
      .sort((a, b) => a.localeCompare(b))

    if (models.length === 0) {
      return Response.json({ error: "The provider returned no models" }, { status: 502 })
    }
    return Response.json({ models })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reach the provider"
    return Response.json({ error: message }, { status: 502 })
  }
}
