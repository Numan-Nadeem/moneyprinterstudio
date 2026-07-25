# Design — MoneyPrinter Studio

Visual and interaction design specification. Implemented in Phase 0 ([Phases.md](./Phases.md)); enforced by R6 ([Rules.md](./Rules.md)).

---

## 1. Design Direction

**Concept: "The Studio Console."** A dark, focused production environment — closer to an editing suite or a film-ID field guide than a generic SaaS dashboard. Content (storyboards, prompts, generated frames) is the star; chrome recedes. Filmic details are used sparingly and functionally: film-strip perforation motifs on image cards, mono-spaced technical labels (scene numbers, statuses, model IDs), and generous negative space.

Aesthetic references: film production ID guides, editorial type specimens, terminal-adjacent tooling. Premium and restrained — never noisy, never neon.

## 2. Color System (5 tokens total)

Dark theme by default (the tool is used in long creative sessions).

| Role | Token | Value | Usage |
|------|-------|-------|-------|
| Background | `--background` | `#0F0F0E` (near-black, warm) | App canvas |
| Surface | `--card` / `--secondary` | `#1A1A18` | Panels, chat bubbles, scene cards |
| Foreground | `--foreground` | `#F4F2ED` (paper off-white) | Primary text |
| Muted text | `--muted-foreground` | `#8A877E` (warm gray) | Labels, metadata, timestamps |
| Accent | `--primary` | `#E8B64C` (tungsten amber) | Primary actions, active states, progress, focus rings |

Supporting semantic colors (status only, never decorative): success `#5DBB7C`, destructive `#E5604C`.

Rules:
- No purple/violet. No gradients.
- Amber is reserved for actionable/active elements — at most one dominant amber element per view.
- Status colors appear only in badges, progress states, and toasts.
- All colors defined as semantic tokens in `globals.css` (`@theme`); never hardcoded hex in components (R6.8).
- If a token background is overridden, its paired foreground token must be set with it.

## 3. Typography (2 families)

| Role | Font | Usage |
|------|------|-------|
| Sans (headings + body) | **Geist** | UI text, chat content, headings |
| Mono (technical) | **Geist Mono** | Scene numbers (`S.01`), statuses, model IDs, prompts, timestamps, key masks |

- Body: 14–16px, `leading-relaxed`.
- Headings: tight tracking, weights 500–600; scale `text-lg` → `text-3xl`. No decorative display sizes inside the app shell.
- Mono labels: 11–12px, uppercase, `tracking-widest`, muted color — the signature "console" detail (e.g., `SCENE 04 / 07`, `AWAITING CONFIRMATION`, `FLUX-1.1-PRO`).
- Prompts render in mono at 13px inside scrollable, copyable blocks.
- Titles wrapped in `text-balance`; long prose in `text-pretty`.

## 4. Layout System

Mobile-first; flexbox-first (grid only for the gallery and scene-card grids).

### App Shell
- **Desktop (≥1024px):** fixed left sidebar (260px) + fluid main area. Sidebar: logo, the five agents with their chats grouped beneath, then Pipeline Runs / Gallery / Settings, user menu at bottom.
- **Tablet:** collapsible sidebar (icon rail).
- **Mobile:** sheet/drawer sidebar via hamburger; bottom-safe padding for inputs.

### Key Screens

**Chat (`/chat/[chatId]`)**
- Header: agent name + kind badge, model selector (compact select, mono label), chat actions.
- Message list: max-width `max-w-3xl` centered; user messages right-aligned on `--card`; agent messages full-width text on canvas with a thin agent-colored left rule.
- Storyboard messages: rendered markdown with scene headings; a sticky **Delegate** action bar appears on completed storyboards (buttons: Image Pipeline · Video Prompts · Post Processing · All).
- Composer: bottom-fixed, textarea with IME-safe Enter-to-send, streaming indicator.

**Pipeline Run (`/pipeline/[runId]`)**
- Header row: run title, overall progress (`4 / 7 SCENES` + amber progress bar), mode toggle (Auto/Manual), Pause/Stop.
- Scene rail: horizontal on mobile, vertical timeline on desktop — one card per scene.
- **Scene card:** film-strip perforation strip along the top edge; 9:16 thumbnail (aspect-ratio locked, `object-cover`); mono header `S.03 — [TITLE]`; status badge; expandable prompt block; actions contextual to state (Confirm / Regenerate / Retry / Download).
- Focused scene (awaiting confirmation) enlarges with Confirm (amber, primary) and Regenerate (outline) side by side.

**Settings (`/settings`)**
- Tabs: Providers · Instructions · Account.
- Providers: two sections (Text / Image), each a list of provider rows (label, provider logo-less name, masked key `sk-…4f2a` in mono, model, enabled switch, test/edit/delete) with an **Add** button opening a dialog form.
- Instructions: large textarea + reference image dropzone (thumbnail grid, remove on hover, 9:16-agnostic previews).

**Gallery (`/gallery`)**
- Runs as sections; responsive grid `grid-cols-2 md:grid-cols-4 lg:grid-cols-5`, 9:16 cards; hover reveals scene label + download; per-run "Download all".

### Spacing
- Tailwind scale only; section padding `p-4 md:p-6`; card padding `p-4`; gaps via `gap-*` (never `space-*`, never mixed margin+gap).
- Radius: `--radius: 0.5rem` — crisp, tool-like (avoid pill-heavy styling except badges).

## 5. Components (shadcn/ui base)

| Component | Usage |
|-----------|-------|
| Button | Primary = amber solid (dark text); secondary = outline; destructive for delete/stop |
| Select | Model/provider pickers (mono option labels) |
| Dialog | Add/edit provider forms, delete confirmations |
| Sheet | Mobile sidebar |
| Badge | Statuses: pending (muted), generating (amber, pulsing dot), awaiting confirmation (amber outline), confirmed (success), failed (destructive) |
| Progress | Pipeline progress |
| Switch | Auto/Manual mode, provider enabled |
| Tabs | Settings sections |
| Skeleton | Loading chats, gallery, pipeline |
| Tooltip | Icon-rail nav, truncated labels |
| Sonner/Toast | Save confirmations, pipeline events, errors |

Icons: **lucide-react** exclusively, 16/20px, `stroke-width: 1.75`. Never emojis as icons.

## 6. Motion

Minimal and purposeful:
- Streaming text: native token flow (no artificial typewriter effects).
- Generating state: subtle pulsing dot on badge + shimmer skeleton over the 9:16 placeholder.
- Scene advance: newly active card scrolls into view with a short ease-out.
- No parallax, no scroll-jacking, no decorative animation. Respect `prefers-reduced-motion`.

## 7. States & Feedback

- **Empty states:** every list (chats, providers, runs, gallery) has an explanatory empty state with a single primary action (e.g., "No image providers configured → Add provider").
- **Errors:** inline, actionable, human-readable (R5.6). Pipeline failures show on the failed scene card with Retry.
- **Confirmation:** all destructive actions use a Dialog with explicit consequence text.
- **Progress:** any operation > 1s shows visible progress or a skeleton; nothing dead-ends (R6.6).

## 8. Accessibility

- WCAG AA contrast on all token pairs (amber on dark passes for large text/buttons with dark foreground text on amber fills).
- Full keyboard support: chat composer, delegation menu, pipeline controls, dialogs (focus-trapped).
- ARIA: live region for streaming responses and pipeline status changes; labeled icon buttons; `sr-only` text where icons stand alone.
- Images: generated images get alt text `Scene {n}: {scene title}`; decorative film-strip motifs are `aria-hidden`.
- Visible focus rings (amber) on all interactive elements.

## 9. Metadata & Branding

- App name: **MoneyPrinter Studio**. Wordmark set in Geist, weight 600, with a mono `STUDIO` suffix label.
- `layout.tsx` metadata: title template `%s — MoneyPrinter Studio`; description reflecting the storyboard-to-video pipeline; `theme-color` `#0F0F0E`.
- `<html className="bg-background">` set in the root layout.
- Favicon/logo: minimal filmstrip-frame glyph, amber on near-black (generated asset, no placeholders).
