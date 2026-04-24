the process

discuss before building. ask clarifying questions first, never assume. write a scoping doc before code.

scoping doc has two parts. part 1 is the full picture — what we're trying to achieve end-to-end. part 2 is a small POC to verify assumptions against real data and real systems. learnings from the POC go back into the doc, then we scale up. don't skip the POC just because the plan "seems obvious."

research before designing. the answer is usually already in the codebase — grep before you design. don't guess at rate limits, API behavior, or platform constraints.

understand the system before touching it. verify project structure, deployment targets, configs, access, and permissions upfront. map every API call to its required scope. tell the user everything they need before they start.

store all incoming data, never filter. every field, every piece of metadata. filtering at ingestion loses information permanently.

dump the full schema before the first query. incremental discovery multiplies rework.

DB is the source of truth. for long-running pipelines, design three independent persistence layers — authoritative store, per-item checkpoint, derived view regenerated on a timer. never hold state in process memory.

the build path (non-trivial work)

non-negotiable for anything bigger than a one-line fix:

1. plan — what each subagent builds, which files they touch, acceptance criteria.
2. 3 build subagents in parallel, each owning an independent slice. one multi-tool-call message.
3. 3 review subagents in parallel after builds return. each reviews a slice against the brief and hunts for regressions, spec violations, edge cases.
4. fix all findings — blockers, should-fixes, nits. don't defer.
5. second review pass with "decisions already made: X, Y, Z — don't re-litigate" framing. pass two reliably finds 1-2 more issues pass one missed because it sees the fixed code.
6. ship.

coordinate, don't code. parallelize by scoping and deploying agents. stay free to make decisions. the review subagent is the safety net — no plan-approval gates needed.

quality bar

think from the user's seat. before coding, write one sentence: "the user sees ___." if the answer is a DB id, blank page, or internal format — the design is wrong before a line of code.

when cloning a product, use the original first. open it, observe, map every detail. reference is the spec, not your memory of it.

verify with your own eyes. build passing isn't the bar — a human looking at it without wincing is. use playwright/browser tools for any UI feature.

fix root causes, not symptoms. reproduce the exact failing scenario end-to-end before pushing a fix.

after shipping

learnings.md at repo root. process failures first — what did we do first vs. what should we have done first. not a changelog. cross-project learnings go in central memory.

post-ship trio (parallel subagents): append process learnings, commit the scope doc via its own docs PR, author NRQL monitoring queries for any custom events.
