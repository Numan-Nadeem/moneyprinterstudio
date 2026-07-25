# Rules — MoneyPrinter Studio

Non-negotiable constraints for building and evolving this application. Every phase in [Phases.md](./Phases.md) must comply. When a rule and convenience conflict, the rule wins.

---

## R1 — Master Prompt Fidelity

1. The five master prompt `.md` files in the repository root are the **single source of truth** for agent behavior.
2. Master prompts are loaded verbatim as system prompts. Never rewrite, summarize, trim, reorder, "optimize," or annotate their content at runtime.
3. Any injected additions (user instructions, orchestration wrappers) are **appended in clearly delimited sections** — they must never override or contradict a master prompt's explicit rules.
4. Behavior changes to an agent happen by editing its `.md` file only — never by code-side prompt patches.
5. Agent 5 (Post Processing) uses the **strict** extractor (`Storyboard_Video_Prompt_Extractor_Master_Prompt.md`): zero inference, omit missing sections, never invent content. Agent 4 uses the variant that permits inference of clearly-implied sections. Do not conflate them.

## R2 — Pipeline Integrity

1. Extracted image prompts are passed to the image provider **exactly as extracted** — no rewriting, prefixing, or truncation (reference images are attached separately, not merged into the prompt text).
2. Scenes are processed **strictly sequentially** in storyboard order. Never parallelize scene image generation within a run (continuity depends on order).
3. Exactly **one image per prompt** per attempt (per the Image Generator master prompt). Regeneration creates a new version; it never silently overwrites.
4. Never skip a scene. A failed scene pauses the run; it does not advance.
5. In **manual mode**, no scene advances without explicit user confirmation. In **auto mode**, the user must always be able to pause or stop.
6. All pipeline state transitions are persisted before being reported to the client. A reload must never lose or corrupt run state.
7. Delegation is always **user-initiated**. Agents never auto-delegate on their own.

## R3 — Security

1. Provider API keys: encrypted at rest (AES-256-GCM), decrypted only server-side within request scope, never logged, never returned to the client after save (masked display only).
2. All AI provider calls originate from the server. No key or provider call ever runs in the browser.
3. Every query against user-owned tables filters by the authenticated session's `user_id`. No shared or unscoped reads/writes.
4. All route handlers and server actions validate input with zod and validate the session before touching data.
5. Blob assets (generated + reference images) are private; access is authorized against the owning user.
6. No secrets in client bundles, URLs, or logs. `ENCRYPTION_KEY` and `BETTER_AUTH_SECRET` are server-only.
7. Parameterized queries only (Drizzle). Never interpolate user input into SQL.
8. Upload validation: images only, MIME-checked, ≤ 10 MB per file.

## R4 — Data & Persistence

1. Neon Postgres is the system of record; Vercel Blob stores binary assets. **No localStorage/IndexedDB for domain data.**
2. Chats, messages, pipeline runs, scenes, images, provider configs, and settings all persist and are resumable across devices.
3. Destructive actions (delete chat, delete provider, delete run) require explicit confirmation in the UI.
4. Deleting a provider config must not break historical records — runs/chats keep denormalized model names for display.
5. Schema changes go through migration scripts; never mutate production schema ad hoc.

## R5 — Code Quality

1. TypeScript strict mode; no `any` in domain logic.
2. All AI interaction goes through the AI SDK abstractions in `lib/ai/` — no direct `fetch` to provider endpoints outside the unified image module.
3. Components small and composed; pages assemble components (no monolithic `page.tsx`).
4. SWR for client data fetching/polling; no data fetching inside bare `useEffect`.
5. Server Components by default; `"use client"` only where interactivity requires it.
6. Errors surfaced to users are actionable ("Invalid API key for OpenAI provider 'Personal'") — never raw stack traces; raw errors go to server logs.
7. Agent registry (`lib/agents/registry.ts`) is the only place agent definitions live. UI, chat API, and pipeline all read from it.

## R6 — UX Rules

1. Model/provider selectors show only **compatible** providers (text agents → text providers; image generator → image providers).
2. If no compatible provider is configured, the chat/pipeline shows a clear empty state linking to Settings — never a cryptic failure.
3. Streaming for all text agent responses.
4. Pipeline view always shows: current scene, per-scene status, overall progress, and active mode — at a glance.
5. Every generated image is downloadable; batch download always available for completed and partial runs.
6. Long-running operations show progress and are cancelable; the UI never dead-ends.
7. Mobile-first responsive layouts (see [Design.md](./Design.md)).
8. Design-system tokens only — no hardcoded hex colors in components.

## R7 — Scope Discipline

1. No video generation in v1 — prompts only (PRD non-goals).
2. No feature may bypass the confirmation model of the pipeline.
3. New agents may only be added via the registry + a master prompt file, following R1.
4. Spec documents in `docs/` are updated in the same change set as any architectural deviation — code and docs never drift.
