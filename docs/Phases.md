# Phases — MoneyPrinter Studio

Implementation plan, ordered by dependency. Each phase produces a working, verifiable increment. Do not start a phase before its prerequisites are complete.

**Related docs:** [PRD.md](./PRD.md) · [Architecture.md](./Architecture.md) · [Rules.md](./Rules.md) · [Design.md](./Design.md)

---

## Phase 0 — Project Foundation

**Goal:** Runnable Next.js 16 app with the design system and app shell.

- Scaffold Next.js 16 (App Router, TypeScript strict, Tailwind v4, shadcn/ui).
- Implement design tokens, fonts, and global styles per [Design.md](./Design.md).
- App shell: sidebar layout (agent list, chats, nav to Pipeline / Gallery / Settings), responsive.
- Agent registry (`lib/agents/registry.ts`) + master prompt loader importing the five root `.md` files verbatim.
- Placeholder pages for dashboard, chat, settings, gallery.

**Done when:** App renders the shell with all five agents listed; master prompts load and are inspectable in dev.

## Phase 1 — Database & Auth

**Goal:** Multi-user foundation with persistent storage.

- Connect Neon integration; set up Drizzle with the full schema from [Architecture.md §5](./Architecture.md).
- Better Auth email + password (sign-up, sign-in, sign-out pages); verify `BETTER_AUTH_SECRET`.
- Route protection (proxy/middleware + per-handler session checks).
- Migration scripts; seed nothing (user-generated data only).

**Done when:** A user can register, sign in, and reach the protected shell; all tables exist; unauthenticated access redirects.

## Phase 2 — Settings: Providers, Instructions, Reference Images

**Goal:** BYOK configuration surface (prerequisite for all AI features).

- `ENCRYPTION_KEY` handling + AES-256-GCM crypto module.
- Provider CRUD: add-forms (per PRD F2) for text and image providers; masked key display; enable/disable; delete with confirmation.
- "Test connection" endpoint per provider type.
- Global instructions field + reference image upload to Blob (multi-file, preview, remove).
- Confirmation mode default (auto/manual) and per-agent default model settings.

**Done when:** User adds a text and an image provider, both pass connection tests; instructions and reference images persist; keys are never exposed post-save.

## Phase 3 — Agent Chats (Text Agents)

**Goal:** Working chats for the four text agents.

- Universal chat page: message list, streaming responses, markdown rendering, input with IME-safe Enter handling.
- Chat CRUD: create per agent, rename, delete; sidebar grouping by agent.
- `POST /api/chat`: system prompt assembly (master prompt + user instructions), history, `streamText`, persistence.
- Per-chat model selector filtered to compatible providers; empty state linking to Settings when none configured.
- Verify each agent honors its master prompt Step-1 behavior (e.g., Storyboard Generator opens with "What's your idea for the video?").

**Done when:** All four text agents converse correctly with the user's own models; history persists and resumes.

## Phase 4 — Image Generator Chat

**Goal:** Standalone image generation chat (agent 3) before pipeline automation.

- Unified `generateSceneImage()` module (`lib/ai/image.ts`) across configured image providers.
- Image Generator chat: paste prompt → exactly one 9:16 image → "Paste the next image generation prompt." per its master prompt.
- Reference images from Settings attached to generation where the provider supports image conditioning.
- Blob storage of outputs; inline display; single-image download.

**Done when:** Pasting an image prompt yields one stored, downloadable image using the user's image provider.

## Phase 5 — Delegation & Pipeline Engine

**Goal:** The core workflow (PRD F4) — the reason this app exists.

- Storyboard detection on completed Storyboard Generator messages → delegation action menu (Image pipeline / Video Prompt Extractor / Post Processing / All).
- Pipeline run creation: extraction step (image prompts per scene, per R2), `pipeline_scenes` rows, run state machine.
- Scene loop: generate → await confirmation → confirm → advance; regenerate with versioning; pause/resume/stop; auto/manual modes with mid-run toggle.
- Pipeline view (`/pipeline/[runId]`): per-scene cards (status, thumbnail, prompt), progress bar, mode toggle, controls; SWR polling while active.
- Non-pipeline delegations: storyboard → Video Prompt Extractor and Post Processing chats (full one-response extraction); delegation links on the source message.
- Failure handling: failed scene pauses run with actionable error + retry; stale-step recovery.

**Done when:** Idea → storyboard → "Delegate to all" → all scene images generated (both modes) and both extractions returned, with zero copy-paste; run survives reload mid-flight.

## Phase 6 — Gallery & Downloads

**Goal:** Image management (PRD F5, F7).

- Gallery page: runs grouped, scenes in order, 9:16 thumbnails, version history per scene.
- Single-image download route (attachment headers, ownership check).
- "Download all" zip per run (`scene-01.png` …), works for partial runs.
- Run list page with status, progress, and resume links.

**Done when:** User can browse every generated image and download individually or as a zip.

## Phase 7 — Hardening & Polish

**Goal:** Production readiness.

- Full pass against [Rules.md](./Rules.md) (security checklist R3, pipeline integrity R2).
- Error-state audit: missing providers, invalid keys, provider rate limits/backoff in auto mode, empty states everywhere.
- Accessibility pass (keyboard nav, ARIA, contrast) and mobile responsiveness audit.
- SEO/metadata for auth pages; loading skeletons; performance check on chat streaming and pipeline polling.
- Browser-verify all primary flows end to end.
- **Create `docs/Memory.md`** capturing final project state, conventions, and decisions (deferred until now by design).

**Done when:** All PRD P0/P1 acceptance criteria pass; Memory.md exists and reflects reality.

---

## Dependency Graph

```
Phase 0 ─▶ Phase 1 ─▶ Phase 2 ─▶ Phase 3 ─▶ Phase 5 ─▶ Phase 6 ─▶ Phase 7
                              └▶ Phase 4 ─▶─┘
```

## Out of Scope (v1) — tracked for later

- Video generation execution (v2 candidate).
- Per-pipeline instruction overrides.
- Project bundle export (storyboard + prompts + images).
- Team/sharing features.
- SSE/live push instead of polling.
