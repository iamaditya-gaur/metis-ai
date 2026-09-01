# Reporting Model Production Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare the reporting-model update for review without exposing client data, changing production, merging, or deploying.

**Architecture:** Keep the existing reporting pipeline and make four focused changes: derive the recipient from the selected account, retain the passing production model defaults while keeping candidates environment-overridable, retry malformed structured responses with bounded cost, and keep all evaluation inputs and results in the ignored private directory. Public tests and docs use generic examples only.

**Tech Stack:** Next.js 16, TypeScript, Vitest, OpenRouter-compatible chat completions, Meta Graph API, GitHub.

---

## File map

- `src/lib/metis/recipient.ts`: sanitize account display names and enforce the final recipient opening.
- `src/lib/metis/types.ts`: carry the selected account name with a reporting request.
- `src/components/reporting-studio.tsx`, `src/components/reporting-form.tsx`: send the selected account name with the account ID.
- `src/app/api/metis/reporting/route.ts`: preserve the account name while keeping tokens server-side.
- `src/lib/metis/reporting.ts`: prefer the account name returned by Meta and enforce it on every final message.
- `src/lib/metis/tone.ts`: split tone and compose model defaults, include the recipient in composition, and fix default score thresholds.
- `scripts/pocs/lib/llm.mjs`: retry empty, malformed, or schema-invalid JSON once and report combined usage.
- `scripts/pocs/lib/reporting.mjs`: use the shared structured-response helper for report summaries.
- `evals/reporting-model-comparison/*`: remove public client identifiers and derive private evaluation identity from the frozen Meta fixture.
- `tests/reporting-eval-controls.test.ts`, `tests/reporting-recipient.test.ts`: cover privacy-safe recipient checks, retries, thresholds, and account-name enforcement.
- `.env.local.example`: document safe, environment-overridable model policy.
- `README.md`, `CHANGELOG.md`, `docs/reporting-context.md`, `docs/handoff/HANDOFF.md`, `docs/handoff/supabase-branching.md`: record the pending behavior using public-safe language and repository-relative paths.
- `package.json`, `package-lock.json`: upgrade Next.js to the patched stable release identified by the dependency audit.

### Task 1: Remove public client identifiers

**Files:**
- Modify: `evals/reporting-model-comparison/config.ts`
- Modify: `evals/reporting-model-comparison/run.ts`
- Modify: `evals/reporting-model-comparison/checks.ts`
- Modify: `evals/reporting-model-comparison/README.md`
- Modify: `tests/reporting-eval-controls.test.ts`
- Modify: `scripts/pocs/lib/accounts.mjs`
- Modify: `src/lib/metis/types.ts`
- Modify: `src/components/reporting-form.tsx`
- Modify: `src/components/setup-readiness-card.tsx`

- [x] Replace client-specific constants and examples with generic values.
- [x] Derive the private evaluation account name and recipient from Meta insight rows, then store them only in the ignored fixture.
- [x] Run the approved client-identifier patterns across tracked files while excluding `.private-evals`; expect no results.
- [x] Rewrite the remote evaluation branch with one sanitized commit based on `origin/main`.

### Task 2: Enforce account identity in client messages

**Files:**
- Create: `src/lib/metis/recipient.ts`
- Create: `tests/reporting-recipient.test.ts`
- Modify: `src/lib/metis/types.ts`
- Modify: `src/components/reporting-studio.tsx`
- Modify: `src/components/reporting-form.tsx`
- Modify: `src/app/api/metis/reporting/route.ts`
- Modify: `src/lib/metis/reporting.ts`
- Modify: `src/lib/metis/tone.ts`

- [x] Write tests for control-character removal, generic/wrong greetings, missing greetings, and Meta-row precedence.
- [x] Add a pure helper that returns an exact, normalized recipient handle and repairs only the opening line.
- [x] Pass the selected account name from the UI, prefer Meta's account name when insight rows exist, and apply the helper before judging, returning, logging, or sending.
- [x] Run `npm test -- tests/reporting-recipient.test.ts`; expect all tests to pass.

### Task 3: Apply the evaluated model policy and structured-output guardrails

**Files:**
- Modify: `src/lib/metis/tone.ts`
- Modify: `scripts/pocs/lib/llm.mjs`
- Modify: `scripts/pocs/lib/reporting.mjs`
- Modify: `.env.local.example`
- Modify: `tests/reporting-eval-controls.test.ts`

- [x] Add tests proving malformed JSON is retried once, required keys are enforced, retry costs are included, and blank threshold variables use defaults 8 and 7.
- [x] Keep production defaults on the passing baseline. The tested Luna/Terra bundle failed the final judge recheck, so it remains evaluation-only.
- [x] Bound structured-response attempts to two per model, retry only response-shape failures, and expose every attempt in usage logs.
- [x] Remove the unavailable model ID from the default chain.
- [x] Fix empty threshold parsing so missing variables use the documented defaults.
- [x] Run `npm test -- tests/reporting-eval-controls.test.ts`; expect all tests to pass.

### Task 4: Patch dependencies and public documentation

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/reporting-context.md`
- Modify: `docs/handoff/HANDOFF.md`
- Modify: `docs/handoff/supabase-branching.md`

- [x] Upgrade `next` and `eslint-config-next` from `16.2.4` to patched stable `16.3.4`.
- [x] Replace local absolute paths with repository-relative links.
- [x] Update architecture, model policy, privacy boundary, known limits, and rollback instructions without naming any client or including IDs, keys, prompts, or results.
- [x] Apply the copy-editing checklist: clarity, consistent voice, sourced claims, concrete wording, formatting, and working links.

### Task 5: Re-run evaluation and quality gates

**Files:**
- Private only: `.private-evals/reporting-model-comparison-august-2026/*`

- [x] Run unit tests, lint, production build, and `npm audit --omit=dev`.
- [x] Run the monthly finalist evaluation with the existing frozen private data and hard budget stop; do not fetch Meta again unless the fixture is invalid.
- [x] Confirm summary facts, exact recipient, voice, JSON shape, latency, and cost for three candidate runs.
- [x] Run a repository and full-history privacy scan with redacted output plus GitHub secret-scanning alerts.
- [x] Run the branch security review and code review; fix verified findings, then repeat affected checks.

### Task 6: Prepare review without production mutation

**Files:**
- Create or update: GitHub pull request for `codex/reporting-model-eval`

- [ ] Confirm the branch diff contains no ignored private files or sensitive strings.
- [ ] Push the rewritten clean branch with `--force-with-lease`.
- [ ] Open a pull request describing model choices, cost result, tests, security checks, rollout, and rollback.
- [ ] Do not merge, deploy, change Vercel environment variables, send Slack messages, or write Supabase evaluation logs.

## Self-review

- Spec coverage: privacy, model changes, context files, README, automated QA, security checks, and merge preparation are each assigned to a task.
- Placeholder scan: no implementation placeholder remains; each task names its files, checks, and expected outcome.
- Type consistency: `accountName` stays optional at the request boundary; the normalized recipient is derived inside the reporting flow and passed as a string or `null`.
