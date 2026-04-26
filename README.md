# Metis AI 

I built **Metis AI**, a standalone reporting tool for Meta Ads teams.

The product lives on the `/reporting` route and does one job well:

- pull real Meta Ads data
- turn it into a factual performance summary
- rewrite that summary so it sounds closer to how the operator already reports to clients or internal teams

This is not meant to be a generic “AI writes reports” product.

It is built around a more specific workflow problem:

> media buyers and lean agencies do not struggle to see metrics inside Meta.  
> they struggle to turn those metrics into a clean, usable, client-ready update fast.

That is the workflow Metis is trying to replace.

---

## The problem

A reporting workflow usually breaks in one of two places:

- the report is factual, but stiff, generic, and not usable as-is
- the report sounds human, but starts inventing tone, structure, or unsupported claims

Most teams still end up doing manual cleanup in Slack, docs, or WhatsApp before they send anything out.

Metis is built to close that gap.

It keeps the reporting grounded in real Meta performance data, but still tries to produce a final message that feels like it came from the actual operator.

---

## How the product works

The current product flow is:

1. User opens `/reporting`
2. User pastes a Meta access token
3. Metis loads the ad accounts available for that session
4. User selects:
   - account
   - date range
   - optional historical reporting context
5. Historical context can be added in two ways:
   - paste old client/team updates
   - upload `.txt` or `.md` files with past reporting examples
6. Metis runs the reporting workflow
7. User gets back:
   - core metrics
   - factual operator summary
   - client-style final message
8. User can copy the final message directly from the client view

---

## What happens behind the scenes

The system runs as a multi-step workflow:

### 1. Meta data pull

Metis fetches real campaign-level insights from Meta for the selected account and reporting window.

### 2. Snapshot building

It converts raw insight rows into a structured reporting snapshot, including:

- spend
- CTR
- CPM
- CPC
- cost per result
- top actions
- top campaigns
- data quality notes

### 3. Factual reporting step

That snapshot is sent into the reporting layer, which generates:

- executive summary
- what changed
- risks
- next actions
- a base Slack-ready message

### 4. Tone profiling

If the user provides past reporting examples, Metis analyzes those messages for:

- voice
- opener style
- structure
- numeric formatting
- pacing
- recommendation style

### 5. Client-style rewrite

The final message is then rewritten to match the operator’s historical style more closely, while staying locked to the factual reporting snapshot.

### 6. Delivery + observability

After the run:

- the final message is shown in the UI
- it can be copied directly from the client view
- it is posted to Slack
- the run is logged with steps, tool calls, and artifacts

---

## Why this fits the MaaS track

I’m positioning this as a **MaaS-style reporting function**, not as a chatbot.

The key idea is:

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

This is the strongest part of the project.

- It uses real Meta Ads data
- It produces real reporting output
- It posts the final output to Slack
- It gives the user a usable final message immediately

This is not a fake demo flow. It is tied to real inputs and a real delivery surface.

### Observability

The project already has a usable observability layer:

- structured run logs
- run summaries
- run detail views
- agent step history
- tool calls
- output artifacts

That means the workflow is inspectable, not opaque.

### Evaluation

There is also a reporting eval layer already in the repo.

The evals check the things that matter most for this product:

- factual grounding
- no invented trends
- tone-context adherence
- message structure fit
- client-safe reporting output

That matters because the biggest failure mode here is not “bad grammar.”  
It is drifting away from how a real operator reports.

### Usable operator interface

The standalone `/reporting` surface is now much more operator-friendly:

- token-based session flow
- clear waiting states
- context input via paste or file upload
- copy action on the final message

So the product is not just technically working. It is becoming easier to operate.

---

## Where the product is still weaker against the rubric

This is not yet a top-end MaaS system.

The biggest gaps right now are:

### Agent org structure

The workflow has multiple specialist stages, but it is still a fixed pipeline.

It does **not** yet have:

- a visible manager agent
- dynamic delegation
- on-the-fly spawning of sub-specialists

### Memory

The system uses within-run context well, but it does not yet have strong persistent memory across:

- clients
- projects
- prior runs
- reusable reporting preferences

### Management UI

The UI is strong as an operator workflow, but it is not yet a full agent-management surface.

A non-technical user cannot yet:

- define a new role
- change agent responsibilities
- manage guardrails in a dedicated control layer

### Evaluation loop maturity

There is an eval set, but it is not yet a full closed-loop system with CI-style gating and automatic regression enforcement.

---

## My honest scoring posture right now

If I submitted this today for the **MaaS** rubric, I would describe it like this:

- strong on **real output**
- credible on **observability**
- credible on **evaluation**
- early but promising on **agent structure**
- still underbuilt on **management UI** and **persistent memory**

So this is a **real submission**, not a concept piece.

But it is also not pretending to be more than it is.

The current version is best understood as:

> a working agentic reporting function for Meta Ads teams, with real output, tone adaptation, and run-level observability already in place

That is the sharpest and most honest framing.

---

## Final positioning

Metis AI is built around a simple but important belief:

**reporting is not finished when the numbers are correct.**  
It is finished when the update is ready to send.

That last mile is where a lot of reporting work still stays manual.

This product is my attempt to automate that layer properly:

- first with factual grounding
- then with operator-style adaptation
- then with real delivery and observability

If I continue building this, the next step is not adding more generic AI surface area.

The next step is deepening the reporting function:

- stronger memory
- stronger agent management
- stronger eval loops
- stronger production readiness

That is the direction I would take this from here.
