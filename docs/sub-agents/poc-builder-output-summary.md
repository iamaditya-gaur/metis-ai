# POC: Builder Output

**Date:** 2026-04-25
**Verdict:** PASS

## What was tested

- Loaded the saved BrandBrief from `poc-brand-brief`.
- Built a structured Campaign Strategist / Copywriter prompt input.
- Attempted to generate `CampaignPlan`, `CopyPack`, and `DraftLaunchSpec` with OpenRouter.

## Outcome

- Brand URL: https://metis-ai-nine.vercel.app
- Objective assumption: LEADS
- Support level assumption: full-campaign
- OpenRouter model used: openai/gpt-5.4-mini
- Funnel stages generated: 3
- TOF variants: 2
- MOF variants: 2
- BOF variants: 2
- Draft status requested: PAUSED
- Result: structured builder output was generated and saved.

## Evidence

- [poc-builder-output-evidence.json](/Users/adi/my-weekender-project/docs/sub-agents/poc-builder-output-evidence.json)

## Next step

- Continue to draft validation once the builder output is reviewed.
