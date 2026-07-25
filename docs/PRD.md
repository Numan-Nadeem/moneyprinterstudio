# PRD — MoneyPrinter Studio

**Product:** MoneyPrinter Studio — an AI Cinematic Storyboard-to-Video Production Pipeline
**Version:** 1.0
**Status:** Draft (approved decisions incorporated)
**Related docs:** [Architecture.md](./Architecture.md) · [Rules.md](./Rules.md) · [Phases.md](./Phases.md) · [Design.md](./Design.md)

---

## 1. Overview

MoneyPrinter Studio is a single web application that unifies five AI agents into one orchestrated production pipeline for creating AI-generated short films (45–60 second cinematic reels). A user starts with a one-line idea and finishes with:

1. A complete Hollywood-structure storyboard (6–8 scenes, Character Bible, continuity-locked prompts).
2. A set of scene-by-scene image generation prompts.
3. Generated cinematic images for every scene (with per-scene confirmation).
4. Extracted video generation prompts, ready for image-to-video tools.
5. Post-processing details per scene (dialogue, sound design, camera, transitions).

Every agent's behavior is governed by a **master prompt** (`.md` files in the repository root) plus **user-provided instructions** (text + reference images) that apply globally to all agents.

## 2. Problem Statement

Creating AI short films today requires juggling multiple chat sessions across multiple tools: one chat to write the storyboard, another to extract image prompts, an image generator to render each scene one by one, and further manual copy-pasting to extract video prompts and post-production details. This is slow, error-prone, and breaks character/scene continuity.

MoneyPrinter Studio removes all manual copy-paste steps by automating agent-to-agent delegation while keeping the human in the loop where it matters (image confirmation).

## 3. Goals

- **G1:** One-click delegation from storyboard → downstream agents. No manual copy-paste.
- **G2:** Sequential, confirmable image generation per scene with auto/manual modes.
- **G3:** BYOK (bring-your-own-key) multi-provider support for both text and image models.
- **G4:** Per-chat model selection so users can mix providers/models per agent.
- **G5:** Global instructions + reference images that inform all agents.
- **G6:** Full persistence — chats, pipelines, images, settings survive across sessions and devices.
- **G7:** Downloadable generated images (single and batch).

### Non-goals (v1)

- Video rendering/generation itself (we produce **prompts** for external video tools, not videos).
- Team collaboration / sharing / multi-seat workspaces.
- Mobile native apps (responsive web only).
- Editing generated images (inpainting, upscaling) — regenerate instead.

## 4. Users

**Primary persona — Solo AI filmmaker/content creator:** Produces short-form cinematic AI reels (YouTube Shorts, TikTok, Instagram Reels). Technically comfortable, owns API keys for one or more AI providers, wants throughput and continuity.

Authentication: **email + password accounts** (multi-user capable). Each user owns their chats, pipelines, provider keys, instructions, and generated images. No cross-user sharing in v1.

## 5. The Five Agents

Each agent is a chat-based AI persona driven by a master prompt file. The files are the **source of truth** for agent behavior and are embedded as system prompts.

| # | Agent | Master Prompt File | Type | Role |
|---|-------|-------------------|------|------|
| 1 | **Storyboard Generator** | `AI_Cinematic_Story_Prompt_Generator_Hollywood_Edition.md` | Text | Turns an idea into a complete 6–8 scene cinematic storyboard with Character Bible, image prompts, video prompts, dialogue, sound design, camera, transitions. |
| 2 | **Image Prompt Extractor** | `AI_Storyboard_Prompt_Extractor_Master_Prompt.md` | Text | Receives a storyboard, extracts ONLY the Image Generation Prompt per scene, serves them one at a time (Continue / Previous / Scene X protocol). |
| 3 | **Image Generator** | `AI_Cinematic_Image_Generator_Master_Prompt.md` | Image | Receives one image prompt at a time, generates exactly one image per prompt with continuity rules, then waits for the next. |
| 4 | **Video Prompt Extractor** | `AI_Storyboard_Video_Prompt_Extractor_Master_Prompt.md` | Text | Receives a storyboard, returns ALL scenes in one response: Video Generation Prompt, Dialogue, Sound Design, Camera, Transition (may infer clearly-implied missing sections). |
| 5 | **Post Processing + Video Details Generator** | `Storyboard_Video_Prompt_Extractor_Master_Prompt.md` | Text | Strict variant: extracts the same per-scene sections but with zero inference — omits missing sections, never generates content, preserves wording exactly. |

**Agent behavior contract:** The app must never mutate, summarize, or "improve" master prompts. See [Rules.md](./Rules.md).

## 6. Core Features

### F1 — Agent Chats

- Dedicated chat interface per agent. Users can create multiple chat sessions per agent.
- Each chat has a **model selector** (provider + model) restricted to compatible provider types (text agents → text providers; image generator → image providers).
- Chat history persists (Neon). Streaming responses for text agents.
- Sidebar lists chats grouped by agent, with rename/delete.

### F2 — Settings: Provider Management (BYOK)

- **Text Generation Providers section:** "Add" button opens a form → provider (OpenAI, Anthropic, Google, xAI, Groq, Mistral, custom OpenAI-compatible), API key, base URL (optional, for custom), default model, display label.
- **Image Generation Providers section:** "Add" button opens a form → provider (OpenAI Images, Google, Fal, Replicate, custom), API key, model, display label.
- API keys are stored **encrypted at rest** server-side and never returned to the client after save (masked display, e.g. `sk-…4f2a`).
- Providers can be edited, disabled, deleted, and validated ("Test connection" action).
- Per-agent default model assignment (e.g., Storyboard → Claude, Extractors → GPT-4o-mini, Images → Fal FLUX).

### F3 — Global Instructions + Reference Images

- Settings contains an **Instructions** field (long text) and a **Reference Images** box supporting multiple image attachments (drag-and-drop / file picker → Vercel Blob).
- Instructions are appended to every agent's system prompt.
- Reference images are passed to the Image Generator as the primary source of truth for character appearance (per its master prompt), and to vision-capable text models as context.

### F4 — The Delegation Pipeline (Workflow)

The core differentiator. Flow:

1. User asks Storyboard Generator for a storyboard (agent asks: "What's your idea for the video?").
2. When a storyboard response completes, a **"Delegate storyboard"** action appears on the message with targets:
   - → Image Prompt Extractor (starts the image pipeline)
   - → Video Prompt Extractor
   - → Post Processing + Video Details Generator
   - → All three ("Delegate to all")
3. **Image pipeline:** the storyboard feeds the Image Prompt Extractor, which extracts Scene 1's image prompt and automatically feeds it to the Image Generator. The Image Generator produces one image, then asks for confirmation.
4. **Confirmation modes:**
   - **Manual mode:** user reviews the image → *Confirm* (advance to next scene), *Regenerate* (re-run same prompt), or *Stop pipeline*.
   - **Auto mode:** confirmation is automatic; the pipeline runs send → generate → advance until all scenes are done. User can pause/stop at any time.
5. The loop continues per scene until "Storyboard complete."
6. Video Prompt Extractor and Post Processing agents each receive the same storyboard and return their full extraction in one response.

**Pipeline UI:** a pipeline view shows per-scene status (pending / extracting / generating / awaiting confirmation / confirmed / failed), the generated image thumbnail, and controls. Pipeline state persists — a user can leave and resume.

### F5 — Image Management

- Every generated image is stored in Vercel Blob and linked to its pipeline run, scene number, and prompt.
- Download single image (original resolution) and **Download all** (per pipeline run, zip).
- Gallery view per pipeline run in scene order (9:16 vertical thumbnails).
- Regenerated images keep history (latest is the "active" image; previous versions viewable).

### F6 — Authentication

- Email + password sign-up / sign-in (Better Auth on Neon).
- All data scoped per user. Session-based route protection on all app pages and API routes.

## 7. User Stories & Acceptance Criteria

### US-1: Provider setup
> As a user, I add my OpenAI key as a text provider and my Fal key as an image provider so extractors and the generator can run.

- AC: Add-provider forms exist for both types, opened via "Add" buttons.
- AC: Key is validated on save (test call) with clear success/failure feedback.
- AC: Key never appears in full in any client response after save.
- AC: Provider appears in model selectors of compatible chats immediately.

### US-2: Generate storyboard
> As a user, I open a Storyboard Generator chat, give my idea, and get a complete 6–8 scene storyboard.

- AC: New chat opens with the agent's Step-1 question.
- AC: Response streams; complete storyboard rendered with markdown formatting.
- AC: A completed storyboard message shows delegation actions.

### US-3: Delegate and run image pipeline (manual)
> As a user, I delegate a storyboard to the image pipeline in manual mode and confirm each scene.

- AC: Delegation creates a pipeline run; extractor loads storyboard; Scene 1 prompt is auto-fed to the Image Generator.
- AC: Image renders in the pipeline view with Confirm / Regenerate / Stop.
- AC: Confirm advances to the next scene automatically; the last scene's confirmation completes the run.
- AC: State persists across reloads mid-run.

### US-4: Auto mode
> As a user, I switch to auto mode so all scenes generate without my intervention.

- AC: Mode toggle (auto/manual) available before and during a run.
- AC: In auto mode each generated image is auto-confirmed and the next scene starts.
- AC: Pause/Stop available at all times; failures pause the pipeline with an error and a Retry action.

### US-5: Delegate to video/post-processing agents
> As a user, I delegate the same storyboard to the Video Prompt Extractor and Post Processing agent.

- AC: Each delegation creates/uses a chat for that agent with the storyboard as input.
- AC: Full extraction returned in one response, formatted per each master prompt.
- AC: Output is copyable per scene and as a whole.

### US-6: Instructions & reference images
> As a user, I set global instructions and attach character reference images so all agents follow them.

- AC: Instructions text + multi-image upload in Settings.
- AC: All subsequent agent calls include instructions; image generation includes reference images.
- AC: Images previewable and removable in Settings.

### US-7: Download images
> As a user, I download individual scene images or all images of a run.

- AC: Per-image download button (original file).
- AC: "Download all" produces a zip named after the pipeline run, files ordered/named by scene.

## 8. Functional Requirements Summary

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1 | Five agent chat interfaces driven by master prompt files | P0 |
| FR-2 | BYOK provider CRUD for text + image providers, encrypted keys | P0 |
| FR-3 | Per-chat model selection | P0 |
| FR-4 | Storyboard delegation actions (single + all) | P0 |
| FR-5 | Sequential image pipeline with auto/manual confirmation | P0 |
| FR-6 | Pipeline state persistence & resume | P0 |
| FR-7 | Image storage, gallery, download (single + zip) | P0 |
| FR-8 | Global instructions + reference images | P1 |
| FR-9 | Email/password auth, per-user data isolation | P0 |
| FR-10 | Regeneration with image version history | P1 |
| FR-11 | Provider connection testing | P1 |
| FR-12 | Per-agent default models | P2 |

## 9. Non-Functional Requirements

- **Security:** API keys encrypted at rest (AES-256-GCM); all provider calls server-side only; per-user row scoping on every query; parameterized queries.
- **Reliability:** Pipeline steps are individually retryable; a failed step never corrupts run state; long-running generation survives page reloads.
- **Performance:** Text streaming starts < 2s after send (provider permitting); pipeline view updates in near-real-time (polling or SSE).
- **Usability:** Mobile-first responsive; keyboard-accessible chat; WCAG AA contrast.
- **Cost transparency:** All AI calls use the user's own keys; the app itself incurs no inference cost.

## 10. Success Metrics

- Time from idea → all scene images generated (target: < 15 min for 7 scenes in auto mode, provider-dependent).
- Pipeline completion rate (runs completed / runs started) > 80%.
- Zero manual copy-paste required for the happy path.

## 11. Open Questions

- Should auto mode have a configurable delay between scenes (rate-limit friendliness)? *(Default: small fixed delay + provider error backoff.)*
- Per-pipeline instruction overrides in addition to global instructions? *(Deferred to v1.1.)*
- Export storyboard + prompts + images as a single project bundle? *(Deferred.)*
