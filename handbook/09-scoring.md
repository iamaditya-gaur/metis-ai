# Scoring

How your submission is scored. Every track has its own rubric with weighted parameters. Read the section for your track. Skim the rest.

## Rubric 101 — L1 to L5

Each parameter is scored **L1 to L5**. A lens, not a spreadsheet you fill at the end. Apply the rubric to your own build as you go — that's how you know if you're tracking toward the top two.

| Level | Name | Meaning |
|-------|------|---------|
| **L1** | Floor | Didn't attempt. 0 points. |
| **L2** | Baseline | Attempted. Missing the core. |
| **L3** | Working | Does what it claims. |
| **L4** | Strong | Real quality. Stands out in the zone. |
| **L5** | Exceptional | Reachable if you ship well. Overflow stacks on top. |

> **How to read a rubric row.** Every track has its own parameters. Each parameter has its own weight. Points for that parameter = `(L − 1) × weight`. L5 on a 20x-weight parameter is 80 points. L3 on the same parameter is 40. Virality and MaaS totals cap at **164 base points**. Revenue caps at **176** because it is the hardest track. Overflow on top, uncapped.

---

# 🎯 Virality rubric — 164 base + overflow

Narrative matters, platform does not. X, LinkedIn, YouTube, Instagram — all count the same on impressions. Ad-driven numbers are discounted to 25% of face value. Four of the five parameters have an **overflow rule**: past the L5 ceiling, every additional increment adds points on top, uncapped. Going truly viral should pay disproportionately.

| Parameter | Weight | Max | L1 | L2 | L3 | L4 | L5 | Overflow |
|-----------|--------|-----|----|----|----|----|----|----------|
| **Impressions and views** — weighted total: organic + (ads × 0.25), aggregated across all platforms over the full 4-day sprint | 1x | 4 | Under 500 | 501 to 5k | 5k to 15k | 15k to 30k | 30k to 50k | Beyond 50k: +1 pt × 1x per additional 5,000 impressions |
| **Reactions and comments** — organic + (ad-driven × 0.25), aggregated across platforms across the 4 days | 2x | 8 | Under 15 | 15 to 50 | 51 to 150 | 151 to 300 | 301 to 600 | Beyond 600: +1 pt × 2x per additional 50 reactions |
| **Amplification quality** — not volume, whose accounts reshared. Notable = 10k+ followers with domain authority | 3x | 12 | None | 1-2 peer builders commenting or liking | 3+ peer builders engaging, or 1 sub-10k-follower founder/operator engaging | 1 notable (10k+) founder or operator reshare | Multiple notables engaging, PH feature, press, or known investor amplification | — |
| **Visitors to product** — unique visitors from PostHog, Plausible, GA4, or Datafast across the 4 days. Read-only access required or capped at L2 | 10x | 40 | Under 50 | 51 to 250 | 251 to 1,000 | 1,001 to 3,000 | 3,000+ | Beyond 3k: +1 pt × 10x per additional 300 visitors |
| **Signups or meaningful actions** — signup, install, account creation, first-use event. Team members do not count. Anonymous visits do not count. The heaviest virality parameter | 25x | 100 | Up to 25 | 26 to 100 | 101 to 500 | 501 to 1,500 | 1,501 to 5,000 | Beyond 5k: +1 pt × 25x per additional 200 signups |

**Virality total base**: 4 + 8 + 12 + 40 + 100 = **164 points**. Overflow uncapped.

### Worked examples (Virality)

- **Impressions L5 + overflow.** Over 4 days: X 42k organic, LinkedIn 18k, YouTube 15k views. Plus ₹5k of X ads pulling 40k impressions. Weighted = 42k + 18k + 15k + (40k × 0.25) = 85k. Base L5 = 4 pts. Overflow = (85k − 50k) / 5,000 = 7 additional points × 1x. **Total: 4 + 7 = 11 pts**
- **Amplification L4.** Launch thread reshared by a founder with 42k followers. One notable reshare, not multiple. Lands L4. **(4-1) × 3 = 9 pts**
- **Signups L5 + overflow.** 6,200 signups across the 4 days. Base L5 = 100 pts. Overflow = (6,200 − 5,000) / 200 = 6 additional points × 25x = 150. **Total: 100 + 150 = 250 pts**

> ⚠ **What actually goes viral.** People care about themselves. That is the whole game.
>
> Spotify Wrapped. GitHub year-in-review. 16Personalities. Wordle's score grid. Duolingo streaks. BuzzFeed quizzes. BeReal. Every viral loop that has worked in the last decade works the same way: the product gives the user a personalized artifact about themselves — a stat, a result, a portrait, a score, a label — that is true, interesting, and one-click shareable. The user posts because the post is about them. Their network clicks in to see what their version looks like. Loop runs.
>
> A virality-track build without a personal artifact to share is not a viral product. It is an ad. No amount of clever copy fixes that.
>
> **The practical test:** what does a user screenshot from your product? If the answer is "the landing page" or "the feature list" — no viral loop. If the answer is "their personalized dashboard, result, stat card, label, or ranking" — viral loop present.

> **Why overflow exists.** Each track has uncapped overflow on its strongest signals: Virality (four parameters), Revenue (signups, revenue generated, waitlist), MaaS (real output). L5 should feel reachable in a 4-day sprint if you ship well. Going past L5 should compound. Teams that truly break out earn disproportionate upside.

---

# 💰 Revenue rubric — 176 base + overflow

Revenue is the hardest track. Real demand in a 4-day window is still rare, so the rubric weights observable signals: signups, product quality, and real money moved. The VC-lens parameters (pain, SOM, right to win, why now, moat) stay in as directional signals but carry lower weight. **100% live product. No decks.** Signups, revenue generated, and waitlist all carry uncapped overflow on top of base.

| Parameter | Weight | Max | L1 | L2 | L3 | L4 | L5 | Overflow |
|-----------|--------|-----|----|----|----|----|----|----------|
| **Signups** — root parameter. Email + first-use event (created an account, generated an output, ran the core flow) across the 4 days. Team members do not count. Anonymous visits do not count | 20x | 80 | 0 | 1 to 50 | 51 to 250 | 251 to 750 | 751+ | Beyond 750: +1 pt × 20x per additional 100 signups |
| **Live product quality** — time to first value, task completion rate, UX craft, perceived differentiation | 8x | 32 | Broken | Rough MVP, happy path only | Working product, does what it claims | Polished, noticeably better than alternatives | 10x product, magical onboarding, a user cannot tell it was built in 4 days | — |
| **Revenue generated (USD)** — real money moved during the 4-day sprint. Stripe, Razorpay, any payment processor. Not services. See "What counts as revenue" below | 15x | 16 | $0 | Up to $100 | $100 to $500 | $500 to $2,000 | $2,000+ | Beyond $2,000: +1 pt × 15x per additional $500 |
| **Waitlist** — email drop on a landing page. User has not touched the product. Lower weight than signups because intent without commitment | 4x | 16 | 0 | 1 to 150 | 151 to 750 | 751 to 3,000 | 3,000+ | Beyond 3k: +1 pt × 4x per additional 500 entries |
| **Pain point severity** — who has this pain, how often, what they do today, will they pay? | 2x | 8 | Cannot name a specific user or specific pain | Vague persona, "people who want X" | Named user, 1-2 conversations during the day | Named user, 3+ conversations confirming pain, quotes in submission | Named user, 5+ conversations, 1+ "can I pay for this now" moment | — |
| **SOM (bottoms-up math)** — serviceable obtainable market = target users × realistic ACV. Show the math, not the vibe | 2x | 8 | No math attempted | Math attempted but wrong unit or wrong multiplication | Users × ACV correct, under ₹10 cr | Users × ACV correct, ₹10 cr to ₹1,000 cr | Users × ACV correct, over ₹1,000 cr with defensible beachhead segment named | — |
| **Right to win** — founder-market fit + insight. Unfair advantage = 10x better shot than a random team | 2x | 8 | Team could be anyone | Generic interest in the space | Some domain exposure | Direct operator or domain experience, clear insight | Deep founder-market fit, unfair advantage visible in the build itself | — |
| **Why now** — weak: "AI is hot." Strong: specific unlock (capability, regulation, behavior shift) in recent past | 1x | 4 | Could have been built 5 years ago | Riding general trends | Clear tailwind in last 2 years | Specific unlock in last 12 months | Window opened under 6 months ago, visible in the product | — |
| **Moat and defensibility** — taste counts as moat when it shows up in product craft (Linear, Superhuman) | 1x | 4 | Copyable in a weekend | Thin, first-mover only | Workflow lock-in, integrations, taste | Data flywheel, network effects, switching costs | Compounding moat: proprietary data + network effects strengthen with scale | — |

**Revenue total base**: 80 + 32 + 16 + 16 + 8 + 8 + 8 + 4 + 4 = **176 points**. Signups, revenue generated, and waitlist overflow on top, uncapped.

> ⚠ **What counts as revenue.** Revenue means money earned from selling a product. Not money earned from selling your team's time.
>
> **Qualifies:** Paid product signups (Stripe, Razorpay, one-time or subscription). API or usage fees processed during the sprint. Paid templates, prompts, or digital goods downloaded from the product. Premium tier upgrades on a product built during the weekender.
>
> **Does not qualify:** Consulting, agency, or "done-for-you" service fees — you are selling hours, not a product. Human-in-the-loop work the team performs manually (tech support, VA tasks, content writing by hand, research reports typed up). If the team is the delivery mechanism, it is a service. Payments from team members, event attendees asked to "test the flow," or friends of the team. Gifts, tips, or donations reframed as revenue.
>
> **The test:** if you removed the product tomorrow, does the revenue also disappear? If yes, it counts. If no (the team would still get paid for services rendered), it does not.

> **Revenue is uncapped past L5.** Past $2,000, every additional $500 earns 15 more points. No ceiling.
>
> A breakout revenue team in a 4-day sprint is rare enough to deserve uncapped upside. $2,000 is L5. $5,000 adds 90 points on top. $10,000 adds 240. A team that drives $20,000 of real product revenue across the sprint earns 540 overflow points on this parameter alone.

> **Don't wing SOM. Use the calculator.** SOM = target users × realistic ACV. Simple in theory, easy to get wrong. Wrong base ("all Indians" instead of "Indian designers on Behance"), wrong unit (monthly × 12 when you meant annual), wrong ACV. Any of these and your SOM lands at L1 or L2, regardless of how good your product is.
>
> We built a custom GPT that walks you through the math live. Paste your idea, it asks the clarifying questions, outputs a defensible SOM with the calculation shown.
>
> → [GrowthX TAM/SAM/SOM calculator](https://chatgpt.com/g/g-69e3e8e4f7a88191a36156ceba0f0c05-growthx-tam-sam-som-calculator)

### Worked examples (Revenue)

- **Signups L5 + overflow.** 1,050 signups across 4 days. 680 came via a cofounder's twitter thread (18k followers). Landing page → signup → first invoice generated. Base L5 = 80 pts. Overflow = (1,050 − 750) / 100 = 3 additional points × 20x = 60 pts. **Total: 80 + 60 = 140 pts**
- **Live product L5.** User lands, signs up with email only, sees first AI-generated invoice in 25 seconds. Clean Tailwind UI, no bugs. Visibly better than the 3 Indian invoice tools a quick search surfaces. **(5-1) × 8 = 32 pts**
- **Revenue generated L2.** Team ships a ₹49/month invoice tool. By Saturday 8pm: 18 paying customers outside the team on the monthly plan (₹882) + 6 lifetime-deal takers at ₹499 (₹2,994). Total ≈ $46. That's L2 ($100 threshold not hit). **(2-1) × 15 = 15 pts**
- **SOM L4.** "80,000 freelance designers on Behance India + Upwork India × ₹2,400 avg annual = ₹19.2 cr SOM." Math is correct, segment is real, lands between ₹10 cr and ₹1,000 cr. **(4-1) × 2 = 6 pts**
- **Pain severity L4.** Team built a meeting-notes agent for Indian sales teams. 4 event attendees interviewed during lunch, all confirmed they rewrite Zoom transcripts manually every week. 2 said they'd install it Monday. Quotes in submission. **(4-1) × 2 = 6 pts**

---

# 🤖 MaaS rubric — 164 base + overflow

MaaS = agents as employees. A team of AI agents replaces a full human function: marketing, hiring, sales, legal, support, design, engineering. Builders ship a department, not a bot. A manager agent plans, specialists execute, handoffs pass work between them, memory persists across tasks, and a control surface lets a non-engineer assign work.

**Framework: if an agency was run with agents instead of humans, how would it work?**

Scoring covers two things. The product produces real output (blogs published, JDs posted, tickets closed, contracts reviewed). The system is controllable and improvable (you can see what it's doing, correct failures, make it better over time). Verification means a real task in your declared domain landing on a real surface — screenshots, published URLs, timestamps. No staged demos. Real output has an overflow rule: past L5, every additional real task completed autonomously adds points on top, uncapped.

| Parameter | Weight | Max | L1 | L2 | L3 | L4 | L5 |
|-----------|--------|-----|----|----|----|----|----|
| **Working product shipping real output** — root parameter. Real surface = a system a paying customer could use tomorrow. Staged WordPress or sandbox Gmail = L3 max. Overflow past L5: +1 pt × 20x per additional real task completed autonomously during judging | 20x | 80 | Demo only, canned responses | Agents run but output is broken or hallucinated | Working output on a staged or test surface only | Real output on real surfaces but team has to babysit (human approves every step) | Autonomously completes a real task in declared domain end-to-end, output lands on real live surfaces (live site, real ATS, real support queue, real repo), production quality |
| **Agent org structure** — how the agent team is organized. Flat vs managed, static vs dynamic delegation | 5x | 20 | One monolithic agent does everything | 2-3 agents with hardcoded handoffs, no manager | Clear roles (manager + specialists), static routing | Dynamic: manager agent plans subtasks based on the specific request, delegates, reviews outputs | Emergent org: manager spawns sub-specialists on the fly, agents escalate when stuck, roles self-adjust to task |
| **Observability** — tool-agnostic. What we can see about the system matters, not the logo. See callout below | 7x | 28 | console.log or print statements only | Structured logs written to a file, no UI | Can pull up a specific run and see what each agent did, step by step (any tool: custom, self-hosted OSS, SaaS, OTel) | Trace tree across agents (who called whom), token and cost per step, filter by agent or task | Production-grade: diff two runs side by side, alerts on failure or cost spike, search across runs, senior eng would trust this to debug prod |
| **Evaluation and iteration** — ability to improve the system over time. Manual vs closed-loop | 5x | 20 | No evals | Manual spot-checks ("this run looked fine") | Named eval set exists, run manually to compare versions | Automated eval pipeline, CI-style, fails a release if quality drops | Closed-loop: failed runs feed a growing eval set, version-controlled prompts and agents, measurable gains across versions |
| **Agent handoffs and memory** — does context survive between agents and across tasks? | 2x | 8 | Stateless, each agent starts from zero | Handoffs exist but context is lossy (next agent re-asks for info the previous had) | Short-term memory within a single task | Persistent memory across tasks (agent remembers past customers, past projects) | Hierarchical: working memory (current task) + episodic (past tasks) + semantic (domain facts, team norms) |
| **Cost and latency per task** — lower tier (slower or more expensive) governs | 1x | 4 | Over 30 min OR over $5 | 10 to 30 min OR $2-$5 | 5 to 10 min OR $0.50-$2 | 1 to 5 min OR $0.10-$0.50 | Under 1 min AND under $0.10 |
| **Management UI** — L5 tested live: non-eng volunteer onboards a new role unassisted | 1x | 4 | CLI or code only | Basic web UI, dev-only | Functional UI, a PM could operate with docs | Clean UI, non-eng operates with one walkthrough | Delightful UI, non-eng volunteer onboards a new agent role (defines job, tools, guardrails) in under 10 min unassisted |

**MaaS total base**: 80 + 20 + 28 + 20 + 8 + 4 + 4 = **164 points**. Real output overflow on top, uncapped.

> ⚠ **Observability is tool-agnostic.** Langfuse, Braintrust, Arize Phoenix, OpenTelemetry, Helicone, a self-hosted stack, a homebrewed dashboard reading from Postgres, a 200-line custom React app over a SQLite log — all score the same at every L-tier. The question is not "what tool" but "what can we see about the system, and what can the team do with what they see?"
>
> A team that built observability themselves in 90 minutes and hit L4 is scored exactly the same as a team that wired Langfuse and hit L4. The rubric is capability-based.

### Worked examples (MaaS)

- **Real output L5, legal domain.** Contract review agent org. Manager agent classifies contract type (MSA, NDA, SOW). Specialists redline specific clauses (IP, indemnity, termination, liability). Senior partner agent assembles the redlined PDF and uploads to the team's real Notion workspace. Someone drops a fresh MSA into the intake endpoint; 40 minutes later the redlined doc appears in Notion with agent-authored comments. **(5-1) × 20 = 80 pts**
- **Agent org structure L4, hiring domain.** React hiring agent org. Manager agent reads the JD and plans a sourcing pipeline. Sourcer pulls candidates from GitHub + LinkedIn. Screener writes personalized outreach. Scheduler proposes calendar slots. When the first sourcer's yield drops below threshold, manager dynamically spawns a second sourcer with a different search strategy. **(4-1) × 5 = 15 pts**
- **Observability L5, custom build.** Team built their own observability in 3 hours. Every agent step writes to a Postgres table. A simple React UI queries it. Trace trees render, per-step token + cost columns, side-by-side run diffs (pick two run IDs, see diff), alerts to the team Slack channel on failure or cost spike. No vendor tools. A reviewer can debug a failed run in under 2 minutes. **(5-1) × 7 = 28 pts**
- **Evaluation and iteration L4, support domain.** Customer support agent org with an automated eval pipeline. Team curated 20 real past tickets, each labeled with correct resolution. Every prompt change triggers a GitHub Action running the eval set; quality regression blocks merge. Current prod is tagged v0.7.2 in the repo. **(4-1) × 5 = 15 pts**
- **Management UI L5, design domain.** Non-eng volunteer from the audience asked to "hire" a new design agent for Instagram creatives. Opens the management UI, clicks "new role," pastes a description, uploads 3 example creatives as reference, defines output channel (Figma file or Drive folder). Agent is live and accepting briefs in 7 minutes. Zero help from the team. **(5-1) × 1 = 4 pts**

---

# Bonus points (cross-track)

You pick one primary track. But if you also rack up wins in someone else's track, you get bonus points on top.

1. **Bonus weight = 0.5x the original parameter weight.**
2. **50-point cap per team**, no matter how many bonus parameters you hit.
3. **Evidence requirement is the same as the primary track.** No evidence, no bonus.

## Bonus-eligible parameters

| Source track | Parameter | Original weight | Bonus weight | Max bonus |
|--------------|-----------|-----------------|--------------|-----------|
| Virality | Signups | 25x | 12.5x | 50 |
| Virality | Visitors | 10x | 5x | 20 |
| Virality | Reactions + comments | 2x | 1x | 4 |
| Revenue | Signups | 20x | 10x | 40 |
| Revenue | Live product quality | 8x | 4x | 16 |
| Revenue | Revenue generated | 4x | 2x | 8 |
| MaaS | Real output shipping | 20x | 10x | 40 |
| MaaS | Observability | 7x | 3.5x | 14 |

### Worked example: triple threat

**Primary: Revenue.** Team lands L5 signups, L4 on live product, waitlist, and pain, L3 on SOM and right-to-win, L2 on revenue generated, why now, and moat. Base score = 138. Bonus claims: MaaS real output (L4) = 3 × 10 = 30. Observability (L3) = 2 × 3.5 = 7. Virality signups (L2) = 1 × 12.5 = 12.5. Total bonus = 49.5, rounds up to the 50 cap. **138 + 50 = 188 / 226 + overflow**

---

# Anti-spoof (Virality only)

Visitors and signups can be spoofed. Two ratio checks catch it.

| Check | Max plausible ratio | Penalty if breached |
|-------|--------------------|--------------------|
| **Impressions → visitors** | 1 visitor per 10 weighted impressions (10% CTR max) | Visitors parameter drops to L1 (0 pts) unless team proves verifiable non-social traffic source (newsletter, PH feature, direct shares) |
| **Visitors → signups** | 1 signup per 2 visitors (50% conversion max) | Signups parameter drops to L1 (0 pts) unless team proves verifiable direct-share source (WhatsApp waitlist bypassing the site) |

> **When both flags trigger.** The team goes to manual review. We decide together.

---

# Tie-breakers

When two teams land the same score.

| When | Step 1 | Step 2 | Step 3 |
|------|--------|--------|--------|
| **Per track** | Root parameter score (signups for Virality, signups for Revenue, real output for MaaS) | Live product quality score | Our panel vote |
| **Overall (cross-track)** | Highest single-track score | Our panel vote | — |

## A few honest notes

- **L5 is reachable, not aspirational.** Ship well and you can hit it. Overflow is for teams that blow past L5.
- **Evidence is not optional for L4+.** Stripe shots, signed LOIs, PostHog access — if it's not there, the parameter caps at L3.
- **The showcase is not the score.** Being good on stage doesn't hide a hollow build, and being shaky on stage doesn't hide a strong one. The rubric is applied to what's shipped and submitted, not how you present.
- **You cannot self-select for Sunday.** The top two are chosen by rubric score plus our own evaluation. Your job is to ship something the rubric rewards.
