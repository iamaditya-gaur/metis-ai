  # Metis AI POC Plan

  ## Summary

  Run the POC as a priority-ordered set of narrow proofs, not as a holistic mini-product. Each POC agent should own one dependency
  slice, produce one clear artifact, and either unblock the next slice or stop the chain with a documented blocker. The sequence is
  designed to fail fast on external dependencies first, then validate LLM quality, then prove a thin end-to-end run.

  The POC should stay backend-first, use the already-locked tool choices, and avoid UI work unless a minimal route is needed to
  exercise a backend path.

  ## Current execution status update

  As of `2026-04-25 13:28:17 IST`:

  - `poc-meta-access`: passed
  - `poc-meta-reporting`: passed
  - `poc-brand-research`: passed
  - `poc-brand-brief`: passed on OpenRouter
  - `poc-builder-output`: attempted and currently failing on output-quality validation
  - `poc-report-summary`: still needs rerun on the aligned OpenRouter path

  Active next-step priority:

  1. improve `poc-builder-output`
  2. rerun `poc-report-summary`
  3. then continue the remaining POCs in order

  ## Implementation Plan

  ### Phase 0: POC ground rules

  - Keep the locked decisions from the scope doc unchanged unless a real blocker is discovered.
  - Provider decision update on `2026-04-25 12:54:29 IST`: use `OpenRouter` as the default LLM gateway for all LLM-backed POC slices going forward.
  - Use direct server-side TypeScript REST tools for Meta, official Slack Incoming Webhook, and local brand-research extraction.
  - Every POC agent writes a short summary into docs/sub-agents/ with: what was tested, what worked, what failed, exact blocker if
    any, and what the parent should do next.
  - Every POC slice should save evidence that can later support the MaaS rubric: sample output, sanitized API response, object IDs,
    Slack screenshot, trace ID, or DB row.

  ### Phase 1: External dependency proofs

  #### POC 1: Meta account access

  - Goal: prove the token can list accessible ad accounts.
  - Scope:
      - call GET /me/adaccounts
      - normalize the response into a small internal schema
      - save sanitized output and account list
  - Success criteria:
      - at least one accessible ad account is returned
      - token is never logged
      - pagination and empty-state behavior are known
  - Stop condition:
      - if this fails, do not continue to Meta reporting or draft creation

  #### POC 2: Meta reporting data

  - Goal: prove a selected account returns usable insights for one real date range.
  - Scope:
      - call account insights for one short date range
      - fetch only MVP metrics needed for summary generation
      - document any permission, async-job, or schema issue
  - Success criteria:
      - usable insights rows are returned for one account
      - response shape is stable enough for reporting
      - sanitized sample payload is saved
  - Stop condition:
      - if insights cannot be fetched, builder POCs can continue but reporting path is blocked

  #### POC 3: Slack delivery

  - Goal: prove the backend can send a message to a real Slack channel with Incoming Webhooks.
  - Scope:
      - send one plain-text message
      - send one formatted MVP report-style message
  - Success criteria:
      - both messages land in Slack
      - webhook stays server-side only
  - Stop condition:
      - if this fails, reporting generation can continue, but “real output” is partially blocked

  ### Phase 2: Input-quality and LLM-quality proofs

  #### POC 4: Brand research extraction

  - Goal: prove a brand URL can be converted into a useful text bundle.
  - Scope:
      - use fetch + cheerio
      - crawl homepage plus 3-5 high-signal pages
      - use Playwright only if direct fetch is too thin
  - Success criteria:
      - extracted bundle contains enough signal for positioning, offer, product/category, and tone
      - extraction failure modes are documented
  - Stop condition:
      - if extraction quality is poor, adjust parser before testing the Brand Strategist prompt

  #### POC 5: Brand Strategist output

  - Goal: prove the LLM can turn extracted text into a usable BrandBrief.
  - Scope:
      - run one brand brief prompt on one real brand
      - return structured output only
  - Success criteria:
      - output includes positioning, audience, offer, tone, risks, and missing inputs
      - output is specific, not generic
  - Stop condition:
      - if this is weak, iterate prompt/schema here before touching campaign planning

  #### POC 6: Reporting Analyst output

  - Goal: prove insights data can become a useful Slack-ready summary.
  - Scope:
      - feed real or sanitized real insights into the reporting prompt
      - return structured report and Slack message
  - Success criteria:
      - summary is readable, metric-grounded, and does not invent values
      - next actions are reasonable and concise
  - Stop condition:
      - if this is weak, iterate prompt/schema here before orchestration

  #### POC 7: Campaign Strategist / Copywriter output

  - Goal: prove the builder flow can generate strategy, copy, and draft-safe spec.
  - Scope:
      - input BrandBrief, objective, and support level
      - return CampaignPlan, CopyPack, and DraftLaunchSpec
  - Success criteria:
      - output is structured and specific
      - copy is separated clearly into funnel stages or campaign sections
      - draft spec is narrow enough to validate deterministically
  - Stop condition:
      - if draft spec is too loose or unsafe, tighten schema before Meta draft validation

  ### Phase 3: Write-safety and persistence proofs

  #### POC 8: Paused draft validation

  - Goal: prove the system can validate a draft before any Meta write.
  - Scope:
      - convert DraftLaunchSpec into deterministic write payloads
      - reject ACTIVE status, existing-object updates, and unknown fields
  - Success criteria:
      - payload validator catches unsafe writes
      - required missing assets are surfaced clearly
  - Stop condition:
      - if validation is unreliable, do not attempt Meta draft creation

  #### POC 9: Paused Meta draft creation

  - Goal: prove one safe draft write path on a real account.
  - Scope:
      - create paused campaign first
      - then paused ad set if asset requirements are satisfied
      - only create creative/ad if the account assets and objective allow it
  - Success criteria:
      - at least one paused draft object is created successfully
      - object IDs are captured
      - no existing active object is touched
  - Stop condition:
      - if an asset or permission blocker appears, document it and freeze the write path there

  #### POC 10: Observability and persistence

  - Goal: prove one run is captured in structured local observability logs with enough detail to inspect later.
  - Scope:
      - write one JSONL run log file entry
      - capture run metadata, agent steps, tool calls, and artifacts
  - Success criteria:
      - one run can be inspected by run ID
      - step-by-step trace data exists in the log entry
      - sanitized tool calls are stored
  - Stop condition:
      - if structured local logging is not reliable, stop and fix that before adding any external observability system

  ### Phase 4: Thin integrated proofs

  #### POC 11: Thin reporting flow

  - Goal: prove one minimal end-to-end reporting run.
  - Scope:
      - selected account -> insights -> reporting summary -> Slack -> structured local run log
  - Success criteria:
      - real output lands in Slack
      - run is inspectable
      - no UI polish required

  #### POC 12: Thin builder flow

  - Goal: prove one minimal end-to-end builder run.
  - Scope:
      - brand URL -> extraction -> brand brief -> strategy/copy -> validation -> optional paused draft write -> structured local run log
  - Success criteria:
      - strategy and copy are inspectable
      - if asset requirements are met, at least one paused draft object is created
      - if not, blocker is explicit and reusable for the full build

  ## Agent Split

  Use separate POC agents in this order:

  1. poc-meta-access
  2. poc-meta-reporting
  3. poc-slack-delivery
  4. poc-brand-research
  5. poc-brand-brief
  6. poc-report-summary
  7. poc-builder-output
  8. poc-draft-validation
  9. poc-draft-write
  10. poc-observability
  11. poc-thin-reporting-flow
  12. poc-thin-builder-flow

  Run 1, 3, and 4 in parallel first.
  Run 2 after 1.
  Run 5 after 4.
  Run 6 after 2.
  Run 7 after 5.
  Run 8 after 7.
  Run 9 after 8.
  Run 10 once at least one earlier slice is working.
  Run 11 after 2, 3, 6, and 10.
  Run 12 after 5, 7, 8, and optionally 9.

  ## Test Plan

  Each POC agent must finish with:

  - one explicit pass/fail verdict
  - one short blocker section if failed
  - one saved summary under docs/sub-agents/
  - one evidence item suitable for later judging

  Global POC acceptance:

  - Meta account listing works
  - one real insights pull works
  - one real Slack message works
  - one brand URL yields a usable brief
  - reporting and builder LLM outputs are structured and useful
  - paused draft validation works
  - at least one real paused Meta draft object is created, or the exact missing asset/permission blocker is documented
  - one traced, logged run exists in the local structured observability log
  - one thin reporting flow and one thin builder flow are proven

  ## Assumptions And Defaults

  - Primary implementation language for the POC is TypeScript inside the existing Next.js repo.
  - Meta integration uses direct REST, not MCP.
  - Slack uses Incoming Webhooks, not third-party middleware.
  - Brand research uses local extraction first, not Firecrawl by default.
  - LLM calls are limited to brand brief, reporting summary, and builder strategy/copy.
  - No UI-first POC work.
  - No live campaign modifications under any condition.

  ## One-Line POC Agent Prompt

  Use this as the bootstrap line for every POC agent, then append the specific POC task:

  Read README.md, docs/project context.md, docs/superpowers/plans/2026-04-25-metis-ai-maas-scope.md, and any relevant files under
  docs/sub-agents/. Inspect the current codebase before doing anything. Keep all locked decisions. Work only on the assigned POC
  slice, save a concise summary under docs/sub-agents/, and stop after verification.

  ## Task-Specific Prompt Pattern

  Append one sentence after the bootstrap line in this form:

  Your assigned POC slice is <slice-name>. Prove only this slice, save evidence and a concise summary, and document the exact blocker
  if it fails.
