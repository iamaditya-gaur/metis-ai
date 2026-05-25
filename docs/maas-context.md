# MaaS Rubric Context

Metis AI was originally built as a submission to the **GrowthX AI Buildathon — MaaS (Multi-Agent-as-a-Service) track**. The rubric pushed me to think rigorously about agent structure, observability, evals, management UI, and persistent memory — beyond just "does the LLM call work."

This file preserves the posture-against-rubric notes from earlier versions of the README. The main README has since been rewritten for a general portfolio audience, but the underlying thinking the rubric forced is worth keeping visible.

---

## Why the project fits the MaaS framing

I positioned Metis as a **MaaS-style reporting function**, not a chatbot.

The key idea:

**Metis acts like a reporting employee for a Meta Ads team.**

Instead of just answering questions, it performs a real workflow:

- reads live data
- interprets it
- adapts output to communication style
- produces a deliverable
- logs the full run

That makes this closer to an agent-powered reporting function than a prompt wrapper.

---

## Where the product is strong against the rubric

### Working product shipping real output

The strongest part of the project.

- Uses real Meta Ads data
- Produces real reporting output
- Posts the final output to Slack
- Gives the user a usable final message immediately

Not a fake demo flow. Tied to real inputs and a real delivery surface.

### Observability

A usable observability layer is now in place:

- structured run logs persisted to Supabase
- per-LLM-call capture (model picked, tokens, cost, latency, raw prompts and responses)
- fallback-chain visibility (which models were tried before success)
- a clickable trace UI at `/admin/runs` gated behind a signed-cookie admin gate
- run summaries, run detail views, agent step history, tool calls, artifacts

The workflow is inspectable, not opaque. Debugging "why did the model produce *this*" weeks after the run is now a real workflow.

### Evaluation

A reporting eval layer exists in the repo. The evals check the failure modes that matter most:

- factual grounding
- no invented trends
- tone-context adherence
- message structure fit
- client-safe reporting output

The biggest failure mode here is not "bad grammar" — it is drifting away from how the operator actually reports. The evals target that drift directly.

### Usable operator interface

The standalone `/reporting` surface is operator-friendly:

- token-based session flow
- clear waiting states
- context input via paste or file upload
- copy action on the final message

The product is not just technically working. It is genuinely operable.

---

## Where the product is still weaker against the rubric

Not yet a top-end MaaS system. The biggest gaps:

### Agent org structure

The workflow has multiple specialist stages, but it is still a **fixed pipeline**.

It does not yet have:

- a visible manager agent
- dynamic delegation
- on-the-fly spawning of sub-specialists

Deliberate tradeoff: a deterministic pipeline of small, tight LLM calls is easier to debug, evaluate, and improve than a generic agent loop. The cost is less "agentic" surface area, which the rubric weights.

### Memory

Within-run context is strong, but persistent memory across:

- clients
- projects
- prior runs
- reusable reporting preferences

is not yet built. The schema and observability layer are designed for it; the wiring isn't done.

### Management UI

The UI is strong as an **operator workflow**, but it is not yet a full agent-management surface.

A non-technical user cannot yet:

- define a new role
- change agent responsibilities
- manage guardrails in a dedicated control layer

### Evaluation loop maturity

There is an eval set, but it is not yet a full closed-loop system with CI-style gating and automatic regression enforcement.

---

## Honest scoring posture

If I submitted this for the MaaS rubric today, I would describe it like this:

- strong on **real output**
- credible on **observability**
- credible on **evaluation**
- early but promising on **agent structure**
- still underbuilt on **management UI** and **persistent memory**

This is a real submission, not a concept piece. But also not pretending to be more than it is.

The sharpest framing:

> a working agentic reporting function for Meta Ads teams, with real output, tone adaptation, run-level observability, and durable per-call capture already in place.

---

## Underlying belief

The thesis that drove every decision:

**Reporting is not finished when the numbers are correct. It is finished when the update is ready to send.**

That last mile is where most reporting work stays manual. Metis is built to automate that layer properly:

- first with factual grounding
- then with operator-style adaptation
- then with real delivery and observability

If I continue building this, the next step is not adding more generic AI surface area. The next step is deepening the reporting function — stronger memory, stronger agent management, stronger eval loops, stronger production readiness.
