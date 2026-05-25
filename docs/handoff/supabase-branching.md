# Handoff — Set up Supabase Branching for preview/dev isolation

> **For the agent picking this up:** this is a self-contained handoff. Don't ask the user to recap context. Read this file end-to-end first, then start.

## TL;DR

Production and every preview deployment currently share a single Supabase project. The `SUPABASE_SERVICE_ROLE_KEY` (master DB key) lives in both `Production` and `Preview` Vercel environment scopes. Any bug in any branch's preview deploy could read or corrupt production data. The fix is **Supabase Branching** — give each git branch its own isolated database, automatically.

This task is **not blocking production** — the observability work shipped successfully on `main`. But it closes a real security gap that was deliberately deferred to a separate work session.

## Background — what was just shipped before this handoff

The Metis AI repo (`iamaditya-gaur/metis-ai`, deployed at `https://metis-ai-nine.vercel.app`) just landed three coordinated phases of work on `main`:

- **Tone-fidelity improvements** (PR #1, on branch `feat/tone-fidelity` — _not yet merged, separate review_).
- **Observability layer** (merged): captures per-LLM-call model + tokens + cost + latency + raw prompts/responses for every reporting/builder run; persists to `public.metis_runs` Supabase table; replaces the prior ephemeral `/tmp/.jsonl` log writes that were getting wiped between Vercel cold starts.
- **Admin trace UI** (merged): `/admin/runs` + `/admin/runs/[runId]` gated by `/admin/login` (password in `METIS_ADMIN_PASSWORD` env var, signed cookie). Replaces the legacy public `/app/runs` page.

Reference plan file (full history): `/Users/adi/.claude/plans/good-starting-point-now-inherited-snail.md` — see Phases 3 and 4.

## Current security posture (problem statement)

| Env var | Production | Preview | Development |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ set | ✅ set (mirrored from Production) | (not set) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ set | ✅ set (mirrored from Production) | (not set) |

The Service Role key bypasses RLS — it can read, write, or delete anything in any Supabase table. Today it's on every preview deployment for every branch. Practical risks:

1. **Bigger blast radius if the key ever leaks.** A bug, dependency vulnerability, or accidental log statement on any branch can expose the production database.
2. **Previews share the production DB.** A buggy schema migration tested on a preview branch could damage `waitlist_signups`, `metis_runs`, or any future table. The `env` column in `metis_runs` (preview rows tagged `env=preview`, production rows tagged `env=production`) is a soft mitigation — it filters the admin UI but doesn't prevent damage at the row level.
3. **Preview URLs are unguessable but otherwise open.** Anyone with a preview URL hits the same database as production.

Mitigations already in place (do not regress):
- Admin UI is password-gated via Next.js middleware (`src/middleware.ts` + `src/lib/auth/admin-gate.ts`).
- Service-role key is marked `--sensitive` in Vercel CLI so it can't be read back, only overwritten.
- RLS is enabled on `public.metis_runs`; no public read/write policies exist.

## Goal

Enable **Supabase Branching** so every git branch pushed to GitHub gets an isolated database, and the Vercel↔Supabase integration auto-binds preview deploys to the matching branch DB instead of the production DB.

After this work:
- Production stays on the existing Supabase project.
- Every git branch gets a clone of the schema in a per-branch DB.
- Preview deploys read/write that branch DB; production data is never touched by any preview.
- Merging a branch to main triggers schema migration into production via the Branching mechanism.

## Concrete steps for the next agent

### 1. Verify Supabase plan tier

Branching requires the **Pro** plan or higher. The Free tier does not include it.

```bash
# Use the supabase MCP if available:
# mcp__supabase__get_project_url  → confirms project_ref rzomdapylhcsphwbfecp
```

Or visit https://supabase.com/dashboard/project/rzomdapylhcsphwbfecp/settings/general and check the plan in the Subscription section.

**If the user is on Free tier**: stop and tell them. Don't auto-upgrade — that costs money. Surface the cost and the alternatives:
- **Upgrade to Pro** (~$25/month) to enable Branching.
- **Stay on Free** and accept the shared-DB risk for now (no code change, document the tradeoff explicitly).
- **Use a separate Supabase project for preview** (manually wire two Supabase projects, swap env vars per environment — more setup, no auto-binding).

### 2. Enable Branching in the Supabase dashboard

Once on Pro:
1. Go to https://supabase.com/dashboard/project/rzomdapylhcsphwbfecp/branches
2. Click "Enable Branching"
3. Follow the GitHub integration flow — it will ask to connect the `iamaditya-gaur/metis-ai` repo.
4. Configure the branch naming rule (default: branch name from git becomes the Supabase branch name).

### 3. Configure the Vercel↔Supabase integration to use Branching

The integration is already installed (see Phase 2/3 of the main plan file). It needs to be told to use Branching mode:

1. Go to https://vercel.com/iamaditya-gaurs-projects/metis-ai/integrations
2. Click into the Supabase integration → Settings.
3. Enable "Use Branching for preview deployments."
4. Save. The integration will start swapping `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` per preview deploy automatically.

### 4. Test on a fresh feature branch

```bash
git checkout -b feat/test-branching main
# make a trivial change, e.g. update a comment in README
git push -u origin feat/test-branching
```

Watch for:
- Supabase dashboard shows a new branch created from `feat/test-branching`.
- Vercel preview deployment for `feat/test-branching` gets a different `SUPABASE_URL` env var than production.
- Trigger a `/reporting` run on that preview's URL with the existing admin password.
- Run `select count(*) from public.metis_runs;` on the **production** DB via Supabase MCP — count should NOT have increased.
- Run the same query on the **branch** DB (Supabase dashboard → branch DB → SQL editor) — count should be 1 (the run you just triggered).

If those checks pass, Branching is working. If the count increased on production instead of the branch DB, the integration is mis-wired — stop and investigate.

### 5. Document the new topology

Update `docs/reporting-context.md` (currently mentions Supabase as a single-project setup) to reflect:
- Production project: `rzomdapylhcsphwbfecp`
- Every branch: auto-created branch DB
- How to apply schema migrations going forward (Supabase Branching propagates schema from `main` to branch DBs)

### 6. Open the PR

PR title: `chore(supabase): enable branching for preview deploy isolation`

PR body should call out:
- The security gap this closes
- The plan tier upgrade if applicable
- Verification: the production-DB count test from step 4
- Rollback: Branching can be disabled in dashboard with no code change required

## Constraints — what NOT to do

- **Don't modify the production database directly.** All schema changes flow through Branching now.
- **Don't roll back any of the migrations in `supabase/`.** They're additive and the live DB depends on them.
- **Don't disable the admin gate** (`src/lib/auth/admin-gate.ts`, `src/middleware.ts`). It's load-bearing.
- **Don't touch `feat/tone-fidelity` (PR #1)** — it's a separate review track.
- **Don't merge to main without testing on a branch preview first.**

## Reference files

| File | Why it matters |
|---|---|
| `src/lib/supabase/admin.ts` | Service-role client factory. Reads `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. Will pick up branch DB values automatically once integration is configured. |
| `src/lib/metis/observability/supabase.ts` | `persistRunToSupabase` — the function that writes every run to the table. Already env-aware via `VERCEL_ENV` (tagged `production`/`preview`/`development`). |
| `supabase/metis_runs.sql` | Original table schema. |
| `supabase/0002_metis_runs_user_id.sql` | The `user_id` column add. |
| `supabase/waitlist.sql` | Sibling table; should also propagate to branch DBs via Branching. |
| `docs/reporting-context.md` | Update to document the new topology. |

## Env vars in play

| Name | Scope | Source |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production + Preview | Auto-swapped per branch once Branching is on |
| `SUPABASE_SERVICE_ROLE_KEY` | Production + Preview | Auto-swapped per branch once Branching is on |
| `METIS_ADMIN_PASSWORD` | Production + Preview | Static; same across all envs (used only by admin gate) |
| `METIS_ADMIN_COOKIE_SECRET` | Production + Preview | Static; HMAC secret for the admin cookie |

## Verification checklist (final)

- [ ] Supabase project on Pro plan or higher
- [ ] Branching enabled in Supabase dashboard
- [ ] Vercel↔Supabase integration set to "Use Branching"
- [ ] Test branch deploy triggers a Supabase branch creation
- [ ] Preview deploy of test branch has a different `SUPABASE_URL` than production
- [ ] `/reporting` run on test preview writes to branch DB, NOT production DB
- [ ] `metis_runs` row count on production DB unchanged after preview test
- [ ] Admin UI on production still works
- [ ] `docs/reporting-context.md` updated to mention Branching topology
- [ ] PR opened, reviewed, merged

## Why this matters

The observability layer that just shipped writes user data (Meta ad account performance, tone examples from uploaded files, raw LLM prompts/responses) to Supabase. As soon as the product grows past a single-developer setup, the shared-DB risk becomes material. Doing Branching now — while the data volume is small and there's only one developer — is dramatically cheaper than doing it later under pressure.

---

_Generated automatically as part of the Phase 5 merge work. If anything here is outdated by the time you read it, prefer the actual repo state and the plan file at `/Users/adi/.claude/plans/good-starting-point-now-inherited-snail.md`._
