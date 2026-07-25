# Architecture — MoneyPrinter Studio

**Related docs:** [PRD.md](./PRD.md) · [Rules.md](./Rules.md) · [Phases.md](./Phases.md) · [Design.md](./Design.md)

---

## 1. Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js 16 (App Router) | RSC-first, Server Actions for mutations |
| Language | TypeScript (strict) | |
| UI | React 19, Tailwind CSS v4, shadcn/ui | See [Design.md](./Design.md) |
| AI orchestration | Vercel AI SDK (latest) | `streamText` for text agents, provider-agnostic image generation |
| Database | Neon (Postgres) + Drizzle ORM | Per Neon skill conventions |
| Auth | Better Auth (email + password) on Neon | Session cookies; `BETTER_AUTH_SECRET` required |
| File storage | Vercel Blob (private) | Generated images + reference images |
| Client data | SWR | Chat lists, pipeline polling, settings |
| Zip export | `jszip` (server route) | "Download all" |

## 2. High-Level System Diagram

```
┌────────────────────────── Browser ──────────────────────────┐
│  Chat UIs (5 agents) · Pipeline View · Settings · Gallery   │
└────────────┬─────────────────────────────┬──────────────────┘
             │ Server Actions / Route      │ SWR polling / streaming
             ▼ Handlers                    ▼
┌──────────────────────── Next.js Server ─────────────────────┐
│  Auth middleware (Better Auth session)                      │
│  ┌──────────────┐  ┌───────────────────┐  ┌──────────────┐  │
│  │ Chat API     │  │ Pipeline Engine   │  │ Settings API │  │
│  │ (streaming)  │  │ (step executor)   │  │ (providers,  │  │
│  └──────┬───────┘  └────────┬──────────┘  │ instructions)│  │
│         │                   │             └──────┬───────┘  │
│  ┌──────▼───────────────────▼───────┐            │          │
│  │ Provider Resolver                │            │          │
│  │ (decrypt key → AI SDK instance)  │            │          │
│  └──────┬───────────────────────────┘            │          │
└─────────┼─────────────────────────────────────────┼─────────┘
          ▼                                         ▼
   User's AI providers                    Neon Postgres · Vercel Blob
   (OpenAI, Anthropic, Google,
    Fal, Replicate, …)
```

## 3. Directory Structure

```
/
├── AI_*.md / Storyboard_*.md      # Agent master prompts (source of truth, read-only)
├── docs/                          # Spec documents (this folder)
├── app/
│   ├── (auth)/sign-in, sign-up/   # Auth pages
│   ├── (app)/                     # Authenticated shell (sidebar layout)
│   │   ├── page.tsx               # Dashboard / recent activity
│   │   ├── chat/[chatId]/         # Universal chat page (agent-aware)
│   │   ├── pipeline/[runId]/      # Pipeline run view
│   │   ├── gallery/               # All generated images
│   │   └── settings/              # Providers, instructions, account
│   └── api/
│       ├── auth/[...all]/         # Better Auth handler
│       ├── chat/                  # Streaming chat endpoint
│       ├── pipeline/              # Run control: start/confirm/regenerate/pause/step
│       ├── images/download/       # Single + zip download
│       └── providers/test/        # Connection test
├── components/                    # UI components (chat, pipeline, settings, ui/)
├── lib/
│   ├── agents/
│   │   ├── registry.ts            # Agent definitions → master prompt mapping
│   │   └── prompts.ts             # Master prompt loader (build-time import)
│   ├── ai/
│   │   ├── resolver.ts            # providerConfig → AI SDK model instance
│   │   └── image.ts               # Unified image generation across providers
│   ├── crypto.ts                  # AES-256-GCM encrypt/decrypt for API keys
│   ├── db/ (schema.ts, index.ts)  # Drizzle schema + client
│   ├── auth.ts / auth-client.ts   # Better Auth server/client
│   └── pipeline/engine.ts         # Pipeline state machine
└── scripts/                       # DB migration scripts
```

## 4. Agent Registry

Agents are defined in code, each referencing its master prompt file. Master prompts are imported at build time (raw text) — **never edited, trimmed, or paraphrased**.

```ts
type AgentId =
  | "storyboard-generator"
  | "image-prompt-extractor"
  | "image-generator"
  | "video-prompt-extractor"
  | "post-processing";

interface AgentDefinition {
  id: AgentId;
  name: string;
  kind: "text" | "image";
  masterPromptFile: string;   // repo-root .md file
  description: string;
}
```

| AgentId | kind | Master prompt file |
|---------|------|--------------------|
| `storyboard-generator` | text | `AI_Cinematic_Story_Prompt_Generator_Hollywood_Edition.md` |
| `image-prompt-extractor` | text | `AI_Storyboard_Prompt_Extractor_Master_Prompt.md` |
| `image-generator` | image | `AI_Cinematic_Image_Generator_Master_Prompt.md` |
| `video-prompt-extractor` | text | `AI_Storyboard_Video_Prompt_Extractor_Master_Prompt.md` |
| `post-processing` | text | `Storyboard_Video_Prompt_Extractor_Master_Prompt.md` |

**System prompt assembly (per call):**

```
[master prompt raw text]
+ "\n\n# USER INSTRUCTIONS (apply to all outputs)\n" + user.instructions   (if set)
+ reference images attached as vision inputs                                (if model supports)
```

## 5. Database Schema (Drizzle / Neon)

Better Auth manages `user`, `session`, `account`, `verification` tables. App tables (all with `user_id` FK, every query scoped by session user):

```
provider_configs
  id, user_id, type ('text'|'image'), provider (enum/string),
  label, encrypted_api_key, base_url?, default_model,
  enabled (bool), created_at, updated_at

user_settings
  user_id (pk), instructions (text), confirmation_mode ('auto'|'manual'),
  agent_defaults (jsonb: { [agentId]: { providerConfigId, model } }),
  updated_at

reference_images
  id, user_id, blob_url, filename, created_at

chats
  id, user_id, agent_id, title, provider_config_id?, model?,
  created_at, updated_at

messages
  id, chat_id, role ('system'|'user'|'assistant'), content (text),
  metadata (jsonb: imageUrl?, sceneNumber?, pipelineRunId?), created_at

pipeline_runs
  id, user_id, source_chat_id, source_message_id,
  storyboard_text (text),
  mode ('auto'|'manual'),
  status ('extracting'|'running'|'paused'|'awaiting_confirmation'|'completed'|'failed'|'stopped'),
  current_scene (int), total_scenes (int),
  text_provider_config_id, text_model,
  image_provider_config_id, image_model,
  error (text?), created_at, updated_at

pipeline_scenes
  id, run_id, scene_number, scene_title?,
  image_prompt (text),
  status ('pending'|'generating'|'awaiting_confirmation'|'confirmed'|'failed'),
  active_image_id?, error?, created_at, updated_at

generated_images
  id, scene_id, run_id, user_id, blob_url, prompt_used (text),
  version (int), created_at

delegations
  id, user_id, source_message_id, target_agent_id,
  target_chat_id?, pipeline_run_id?, created_at
```

## 6. Provider Resolver

Converts a `provider_configs` row into an AI SDK model instance at request time:

1. Load config (scoped to session user) → decrypt API key (AES-256-GCM, key from `ENCRYPTION_KEY` env var).
2. Instantiate provider:
   - **Text:** `createOpenAI` / `createAnthropic` / `createGoogleGenerativeAI` / OpenAI-compatible with custom `baseURL`.
   - **Image:** provider-specific image generation (AI SDK `experimental_generateImage` where supported; Fal/Replicate via their APIs behind a unified `generateSceneImage()` interface returning image bytes).
3. Key never leaves the server; client receives only masked identifiers.

**Model selection precedence:** chat/pipeline explicit selection → per-agent default (`user_settings.agent_defaults`) → provider's `default_model`.

## 7. Chat Flow (Text Agents)

1. `POST /api/chat` with `{ chatId, message }` (+ auth session).
2. Server loads chat + agent definition + provider config; assembles system prompt (master prompt + instructions).
3. `streamText()` with full message history; response streamed to client (AI SDK UI stream).
4. On finish, assistant message persisted with metadata.
5. **Storyboard detection:** for `storyboard-generator` chats, a completed assistant message containing scene structure (heuristic: multiple `Scene N` headings) gets delegation actions in the UI. Delegation is always user-initiated.

## 8. Pipeline Engine (State Machine)

The image pipeline is the orchestrated path Storyboard → Image Prompt Extractor → Image Generator.

**Run creation (`POST /api/pipeline`):**
1. Create `pipeline_runs` with the storyboard text, mode, and resolved provider/models.
2. **Extraction step:** call the text model with the Image Prompt Extractor master prompt. Implementation note: rather than simulating the interactive "Continue" protocol turn-by-turn, the engine runs the extractor once with an orchestration wrapper requesting all scene prompts in order (strictly preserving the extractor's normalization and output rules per scene), and stores one `pipeline_scenes` row per scene. This is an internal optimization; per-scene output must be byte-equivalent to the interactive protocol's output.
3. Set `total_scenes`, `current_scene = 1`, status → `running`.

**Scene loop (per scene):**
```
pending → generating          (image request to Image Generator provider,
                               prompt passed EXACTLY as extracted,
                               reference images attached)
generating → awaiting_confirmation   (image saved to Blob, version=1)
awaiting_confirmation → confirmed    (manual: user clicks Confirm;
                                      auto: immediate)
confirmed → next scene begins        (current_scene++)
any → failed                         (error recorded; run → paused)
```

**Controls (route handlers, all idempotent):**
- `confirm` — confirm current scene, advance.
- `regenerate` — new image for same prompt, version++.
- `pause` / `resume` / `stop`.
- `set-mode` — toggle auto/manual mid-run.

**Execution model:** each step runs within a single request (image generation ≤ provider latency). Auto mode advances via chained execution: after a scene is confirmed, the server triggers the next scene's generation; the client polls run state via SWR (2s interval while active). No external queue needed for v1; steps are short-lived and individually retryable.

**Resume safety:** all state lives in Postgres. Reload → client re-fetches run → continues from persisted state. A `generating` scene older than a timeout threshold is considered stale and retryable.

## 9. Delegation Flows (Non-Pipeline Agents)

Delegating a storyboard to Video Prompt Extractor or Post Processing:
1. Create (or reuse) a chat for the target agent.
2. Insert the storyboard as a user message.
3. Run the standard chat flow — the agent's master prompt governs output (all scenes in one response).
4. Record in `delegations`; link is shown on the source message ("Delegated to …" with jump link).

"Delegate to all" performs the pipeline creation + both chat delegations in parallel.

## 10. Image Storage & Download

- Generated images → Vercel Blob (private), path: `runs/{runId}/scene-{n}-v{version}.png`.
- Reference images → `refs/{userId}/{uuid}-{filename}`.
- Single download: authenticated route streams the blob with `Content-Disposition: attachment`.
- Zip download: server route fetches active image per scene, builds zip (`jszip`), names files `scene-01.png` …
- Blob access always authorized against the owning `user_id`.

## 11. Security

- **Auth:** Better Auth session validation in `proxy.ts` (route protection) + per-handler session checks.
- **Data isolation:** every Drizzle query on app tables filters by session `user_id`. No exceptions.
- **Key encryption:** AES-256-GCM via Node `crypto`; `ENCRYPTION_KEY` (32-byte, base64) env var; unique IV per record; keys decrypted only inside server request scope.
- **No client-side AI calls:** all provider traffic originates server-side.
- **Input validation:** zod schemas on all route handlers / server actions.
- **Uploads:** MIME + size validation (images only, ≤ 10 MB each, ≤ 10 reference images).

## 12. Environment Variables

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Neon (integration-provided) |
| `BETTER_AUTH_SECRET` | Better Auth |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (integration-provided) |
| `ENCRYPTION_KEY` | AES-256-GCM key for provider API keys |

User AI keys are **not** env vars — they live encrypted in `provider_configs`.

## 13. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| BYOK multi-provider | User owns costs and choice; app is a pure orchestrator (PRD G3). |
| Neon + Drizzle + Better Auth | Recommended default stack; full persistence + multi-user. |
| Pipeline in Postgres, no queue | Steps are short (< 60s); DB-backed state machine is resumable and simple. Revisit if long video generation is added. |
| Master prompts imported raw at build time | Guarantees fidelity; file = source of truth (Rules R1). |
| Batch extraction internally, per-scene delivery | Fewer LLM round-trips, identical user-visible behavior. |
| SWR polling for pipeline state | Simple, robust with serverless; SSE upgrade possible later. |
