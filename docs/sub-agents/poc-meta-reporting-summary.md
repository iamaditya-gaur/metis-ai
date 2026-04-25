# POC: Meta Reporting

**Date:** 2026-04-25
**Verdict:** PASS

## What was tested

- Verified the env-selected account is accessible to the local Meta token.
- Called `GET /act_<account_id>/insights` at `campaign` level for one unattended-safe reporting window.
- Normalized the returned rows into a reporting snapshot suitable for summary generation.

## Outcome

- Selected account: act_***5114
- Reporting window: 2026-04-18 to 2026-04-24
- Insight rows returned: 6
- Pages fetched: 1
- Total spend: 4243.77
- Total impressions: 320745
- Total clicks: 7695
- Derived CTR: 2.4%
- Derived CPC: 0.55
- Result: the selected account returned usable campaign-level insight rows.

## Evidence

- [poc-meta-reporting-evidence.json](/Users/adi/my-weekender-project/docs/sub-agents/poc-meta-reporting-evidence.json)

## Next step

- Continue to `poc-report-summary` using the saved sanitized reporting evidence.
