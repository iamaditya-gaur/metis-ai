# 2026-04-25 Reporting POCs Session Summary

**Session scope:** unattended-safe reporting slices first, then builder slices, then local-file observability continuation
**Slices executed in order:** `poc-meta-access` -> `poc-meta-reporting` -> `poc-report-summary` -> `poc-brand-research` -> `poc-brand-brief` -> `poc-builder-output` -> `poc-draft-validation` -> `poc-observability` -> `poc-slack-delivery` -> `poc-thin-reporting-flow`
**Latest update:** `2026-04-25 15:18:00 IST`

## Quick status table

### Unattended-safe POCs

| POC | Attempted | Status | One-line check |
| --- | --- | --- | --- |
| `poc-meta-access` | Y | PASS | Real Meta token listed accessible ad accounts and the selected account was available. |
| `poc-meta-reporting` | Y | PASS | Real campaign-level insights were fetched for the configured reporting window. |
| `poc-report-summary` | Y | PASS | OpenRouter rerun produced a usable structured report summary and Slack-ready message. |
| `poc-brand-research` | Y | PASS | Real brand-site extraction produced a reusable text bundle with enough signal for the next builder step. |
| `poc-brand-brief` | Y | PASS | Brand research input was converted into a structured BrandBrief on OpenRouter using `openai/gpt-5.4-mini`. |
| `poc-builder-output` | Y | PASS | Prompt/schema tightening now produces usable `CampaignPlan`, `CopyPack`, and paused-only `DraftLaunchSpec` output. |
| `poc-observability` | Y | PASS | One reporting run is now captured in a local JSONL structured log file without external service setup. |

### Attended or setup-dependent POCs

| POC | Attempted | Status | One-line check |
| --- | --- | --- | --- |
| `poc-slack-delivery` | Y | PASS | Real Slack webhook accepted both the plain-text and formatted reporting messages. |
| `poc-draft-validation` | Y | PASS | Deterministic validation normalized paused-only draft payloads from the passing builder output. |
| `poc-draft-write` | Y | PASS | Real paused campaign creation now works on `Adi personal` after token, payload, and Meta validation fixes. |
| `poc-thin-reporting-flow` | Y | PASS | Thin reporting flow is now proven end to end with Slack and local structured observability. |
| `poc-thin-builder-flow` | Y | PASS | Thin builder flow is now proven end to end with paused draft creation and local observability. |

## Final status

- `poc-meta-access`: **PASS**
- `poc-meta-reporting`: **PASS**
- `poc-report-summary`: **PASS**
- `poc-brand-research`: **PASS**
- `poc-brand-brief`: **PASS**
- `poc-builder-output`: **PASS**
- `poc-draft-validation`: **PASS**
- `poc-observability`: **PASS**
- `poc-slack-delivery`: **PASS**
- `poc-thin-reporting-flow`: **PASS**
- `poc-draft-write`: **PASS**
- `poc-thin-builder-flow`: **PASS**

All planned POCs are now complete at the current thin-proof level.

## What succeeded

- The local Meta token can read accessible ad accounts.
- The env-selected Meta ad account is accessible to that token.
- The first live Meta call revealed a concrete integration issue: Meta rejected deprecated Ads API version routing and required `v25.0`.
- The shared Meta client was updated to default to `v25.0`, after which account access passed.
- Campaign-level insights for the configured date range were fetched successfully from the selected account.
- Reporting summary generation now passes on OpenRouter using `openai/gpt-5.4-mini`.
- Builder output generation now passes after prompt/schema tightening and produces usable funnel stages, copy variants, and paused-only draft spec content.
- Deterministic draft validation now passes against the generated builder output.
- Observability now passes using a local structured JSONL log file instead of external-service setup.
- Slack delivery now passes on a real webhook with both plain-text and formatted reporting messages accepted.
- Thin reporting flow now passes end to end.
- Reporting and draft/action account usage is now split:
  - reporting account: `CB`
  - draft/action account: `Adi personal`
- Lightweight request spacing is now built into OpenRouter, Meta, and Slack helper calls to reduce accidental overuse.
- Meta request control is now stricter on the shared client:
  - fixed spacing remains in place
  - response-header-aware cooldowns now watch `X-App-Usage`, `X-Ad-Account-Usage`, and `X-Business-Use-Case-Usage`
  - write calls still avoid aggressive retries
- Token and payload blockers on draft write are now resolved:
  - long-lived token now includes `ads_management` and `business_management`
  - campaign objective normalization now matches Meta-valid values
  - `is_adset_budget_sharing_enabled` is now set explicitly for campaign create
- Thin builder flow now passes end to end.

## What failed

- No remaining POC slice is currently failed.

Provider and observability updates:

- the repo has now switched from direct OpenAI API usage to OpenRouter as the default LLM gateway
- the POC runner code is now aligned to OpenRouter across reporting and builder slices
- active POC observability is now local structured file logging, not Langfuse/Supabase setup

## Evidence and summaries

- [poc-meta-access-summary.md](/Users/adi/my-weekender-project/docs/sub-agents/poc-meta-access-summary.md)
- [poc-meta-access-evidence.json](/Users/adi/my-weekender-project/docs/sub-agents/poc-meta-access-evidence.json)
- [poc-meta-reporting-summary.md](/Users/adi/my-weekender-project/docs/sub-agents/poc-meta-reporting-summary.md)
- [poc-meta-reporting-evidence.json](/Users/adi/my-weekender-project/docs/sub-agents/poc-meta-reporting-evidence.json)
- [poc-report-summary-summary.md](/Users/adi/my-weekender-project/docs/sub-agents/poc-report-summary-summary.md)
- [poc-report-summary-evidence.json](/Users/adi/my-weekender-project/docs/sub-agents/poc-report-summary-evidence.json)
- [poc-brand-research-summary.md](/Users/adi/my-weekender-project/docs/sub-agents/poc-brand-research-summary.md)
- [poc-brand-research-evidence.json](/Users/adi/my-weekender-project/docs/sub-agents/poc-brand-research-evidence.json)
- [poc-brand-brief-summary.md](/Users/adi/my-weekender-project/docs/sub-agents/poc-brand-brief-summary.md)
- [poc-brand-brief-evidence.json](/Users/adi/my-weekender-project/docs/sub-agents/poc-brand-brief-evidence.json)
- [poc-builder-output-summary.md](/Users/adi/my-weekender-project/docs/sub-agents/poc-builder-output-summary.md)
- [poc-builder-output-evidence.json](/Users/adi/my-weekender-project/docs/sub-agents/poc-builder-output-evidence.json)
- [poc-draft-validation-summary.md](/Users/adi/my-weekender-project/docs/sub-agents/poc-draft-validation-summary.md)
- [poc-draft-validation-evidence.json](/Users/adi/my-weekender-project/docs/sub-agents/poc-draft-validation-evidence.json)
- [poc-observability-summary.md](/Users/adi/my-weekender-project/docs/sub-agents/poc-observability-summary.md)
- [poc-observability-evidence.json](/Users/adi/my-weekender-project/docs/sub-agents/poc-observability-evidence.json)
- [poc-slack-delivery-summary.md](/Users/adi/my-weekender-project/docs/sub-agents/poc-slack-delivery-summary.md)
- [poc-slack-delivery-evidence.json](/Users/adi/my-weekender-project/docs/sub-agents/poc-slack-delivery-evidence.json)
- [poc-thin-reporting-flow-summary.md](/Users/adi/my-weekender-project/docs/sub-agents/poc-thin-reporting-flow-summary.md)
- [poc-thin-reporting-flow-evidence.json](/Users/adi/my-weekender-project/docs/sub-agents/poc-thin-reporting-flow-evidence.json)

## Most important numbers from the passing reporting slice

- Reporting window: `2026-04-18` to `2026-04-24`
- Insight rows returned: `6`
- Total spend: `4243.77`
- Total impressions: `320745`
- Total clicks: `7695`
- Derived CTR: `2.4%`
- Derived CPC: `0.55`

## Next step when resuming

1. Move the passing reporting and builder chains into app routes / orchestration.
2. Preserve the split-account rule and Meta usage controls in the app layer.

## Suggested continuation order

1. app integration
2. demo hardening
