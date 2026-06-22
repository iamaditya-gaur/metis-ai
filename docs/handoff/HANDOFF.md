# Metis AI — current agent handoff

**Last updated:** 2026-06-22 (after Round 9 wrap-up: production landing, history polish, code-cleanup pass)

> Read this file once. Don't pre-load the other docs — they're listed in the "If you need to dig deeper" table at the bottom; open them only when the task at hand actually calls for it.

## Where things stand

- **Branch:** `feat/foundation-and-shell` — fully merged into `main` (fast-forward) on 2026-06-22.
- **Production URL:** https://metis-ai-nine.vercel.app — live on the latest build.
- **Repo + project:** GitHub `iamaditya-gaur/metis-ai`, single Vercel project, single linked Supabase project.
- **Auth gate:** `/app/*` requires a Supabase session. `/admin/*` requires the admin password cookie. `/`, `/reporting`, `/login`, `/signup`, `/reset-password` are public.

## What just shipped on this branch (rounds 5 → 9, after Round 4)

Round 4 already documented below. Subsequent rounds (June 21–22 sessions) added:

1. **Round 5 — Reporting studio rehaul.** Collapsing-wizard input form, brand-matched `DateRangePicker` with presets, unified tone-context drop-zone (`Use preset ▾` dropdown + upload), tabs / inline-disclosure output A/B switch, sentence-case eyebrows, "READY" pill hidden at idle. Reporting brain (`src/lib/metis/*`) untouched.
2. **Round 6 — Sidebar polish + tone-source persistence.** Conventional hamburger toggle in the sidebar header (replaced rail-edge chevron). `:has()` grid switch eliminates SSR/CSR mismatch on collapse. New `meta_tone_sources` Supabase table (RLS-scoped, migration `0008_meta_tone_sources.sql`) backs the `Use preset` dropdown. Auto-saves uploaded files; touch-on-pick.
3. **Round 7 — Production landing page + waitlist deletion.** `/` is now a real landing page with auth-aware `LandingNav` (Sign in + Get started for visitors, Open app for signed-in). Hero / FeatureSections / FinalCta re-anchored on the reporting JTBD. `WaitlistForm` component + `/api/waitlist` route deleted. `waitlist_signups` DB table preserved.
4. **Round 8 — Date-picker viewport-flip + Edit dropdown.** Picker auto-flips above the trigger when below-trigger space is short; max-height + scroll fallback. The studio's "Edit window" CTA became a proper dropdown (Edit inputs / Generate again).
5. **Round 9 — History tab polish + wrap-up.** Sort dropdown (Newest / Oldest / Highest cost / Status), per-row trash delete via a server action, "Open run" CTA promoted to primary. Detail page restructured: client-style message hero at top with copy button, then operator view, metrics, and expand-on-demand details. Top-left "← History" chevron back nav (Linear / Notion pattern). Bottom "Back to history" button removed. Final cleanup pass: lint green (5 errors + 2 warnings fixed), ~200 lines of orphan CSS removed, dead `MissionControlSwitcher` deleted, stale preview URLs scrubbed from docs.

## What shipped pre-merge (rounds 1 → 4, original branch work)

1. **Round 1 — Auth foundation + saved Meta tokens.** Supabase Auth via `@supabase/ssr` with cookie sessions, RLS scoped by `auth.uid()`. Encrypted Meta tokens stored in `meta_connections` (AES-256-GCM, see `src/lib/crypto/token-encryption.ts`). Authed reporting flow at `/app/reports` that uses saved connections instead of re-pasting tokens.
2. **Round 2 — Auth UI rebuild.** Crisp Inter font via `next/font`, no backdrop-filter haze, clean `.auth-card`. Auto-confirm signup pattern (`admin.createUser({ email_confirm: true })` then `signInWithPassword` on same submit).
3. **Round 3 — Env hardening.** `src/lib/supabase/env.ts` is the single source of truth for Supabase env validation (rejects empty strings, names missing var in error). `/api/health` returns booleans for every required env so future deploys can be curl-probed.
4. **Round 4 — Post-login UX rehaul (just landed).**
   - Sidebar moved into `src/app/app/layout.tsx` so it stays mounted across nav (no flash)
   - Per-route `loading.tsx` files for `reports / history / connections / settings` with skeleton-matching shapes
   - Sidebar links use `useLinkStatus` for ~10ms click feedback (2px pending bar + opacity dim)
   - Sidebar collapses to icon-only on desktop (cookie `metis.sidebar` so SSR matches), slides as drawer on mobile
   - `/app/connections` now wraps in `<AppShell>` — single-surface layout with list + inline "+ Add Meta connection" form
   - Save token → `redirect("/app/reports?connection=<id>&saved=1")` with toast on landing
   - Replaced the half-cut floating "Loading ad accounts" dialog with an inline spinner inside the connection picker; errors render inline with Retry
   - Reports empty state is a numbered two-step card pointing at `/app/connections?firstrun=1`

## Hard constraints (user has stated all of these explicitly)

- **Do NOT touch `src/lib/metis/*`** — that's the reporting brain. Off-limits this whole branch.
- **No long-lived Chromium sessions.** `mcp__Claude_Preview__*` + `next dev` + Turbopack ate 60+ GB RAM and crashed the user's machine. QA pattern: `npm run build`, `curl` the deployed preview, Supabase MCP for SQL, one-shot screenshots only (`preview_start → screenshot → preview_stop` in the same tool turn).
- **`vercel env pull` writes empty strings for sensitive vars locally.** You can't fully test on `npm run dev`; test on the deployed preview (where the real envs live).
- **`NEXT_PUBLIC_*` vars are baked at build time** — set them in Vercel for Production, Preview, AND Development before deploying. `/api/health` is the fastest way to confirm.

## What's verified vs. what needs the user

**I (the previous agent) verified:**
- `npm run build` clean
- `/api/health` → 200 with all 8 envs `true` on the current preview
- `/app/connections` (no cookie) → 307 → `/login?next=%2Fapp%2Fconnections` — auth gate intact
- `/app/reports` (no cookie) → 307 — auth gate intact
- `/login`, `/signup`, `/reporting` → 200 — no regressions

**User still needs to click-test on the preview URL:**
- Sidebar collapse toggle persists across reloads
- Mobile drawer opens/closes on a phone-width viewport
- Save-connection flow redirects correctly + pre-selects the new connection
- "Connection saved" toast appears and dismisses cleanly
- Inline accounts loader renders without the half-cut card pattern

## If you need to dig deeper (open these on demand only)

| Question | File to open |
|---|---|
| What does the reporting brain actually do? | `docs/reporting-context.md` (long — only read if user asks about reporting logic) |
| How is the standalone `/reporting` product structured? | `docs/maas-context.md` |
| How does Supabase env loading work? | `src/lib/supabase/env.ts` + `src/lib/supabase/{server,admin,client,middleware}.ts` |
| How does the authed reports flow pull accounts? | `src/components/authed-reporting-studio.tsx` + `src/app/api/metis/accounts/route.ts` |
| Where is the sidebar / shell / nav-link wiring? | `src/components/app-sidebar.tsx`, `src/components/nav-link.tsx`, `src/app/app/layout.tsx` |
| What's in the DB? | `supabase/0001_*.sql` … `0007_*.sql` (all applied) |
| Round 4 plan in detail | `~/.claude/plans/go-ahead-also-you-sequential-prism.md` (only if you want the full rationale; the diff on the latest commit `e10b811` says what shipped) |
| Older release notes / handoffs | `CHANGELOG.md`, `docs/handoff/release-2026-05-25-tone-fidelity.md`, `docs/handoff/supabase-branching.md` |

## Likely next tasks (informed guesses based on user feedback patterns)

- **Per-user tone-preset management UI.** Uploads auto-save into `meta_tone_sources` today; explicit save / rename / delete from pasted text is the next UX gap (see Round 6).
- **Mobile drawer focus-trap.** Still doesn't trap focus when the sidebar drawer is open on mobile.
- **Tooltip upgrade for collapsed-sidebar icons.** Currently native `title` attribute — Linear-style hover tooltip would be more polished.
- **Supabase Branching.** Preview deploys still share the production database. See `docs/handoff/supabase-branching.md`.
- **Wire CI lint + typecheck on PRs.** `npm run lint` and `npm run build` are clean as of Round 9; locking them in via GitHub Actions would prevent regression.
- **Legacy `/app/reporting` and `/app/reporting-new` routes.** Not linked from the new sidebar but still served. Candidate for deletion once you're confident nothing external links to them.

## Tone the user expects

User has a global CLAUDE.md with explicit norms. The most load-bearing ones:
- Plain words, no jargon, explain technical terms inline
- One question at a time, concrete choices ("save to file or show on screen?" not "what persistence strategy?")
- Say what you're about to do in one line before doing it
- Match their energy — one-line message gets one-line reply
- Never claim "done" without verifying. "Haven't tested in browser yet" is honest.
- Push back gently when they're wrong — agreement-only ships bugs
