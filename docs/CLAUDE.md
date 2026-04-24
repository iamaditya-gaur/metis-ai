
# AI Weekender context

This project is part of the GrowthX AI Weekender sprint.

The full handbook lives at `./handbook/` — read files from there when the user asks about:
- ideas, tracks, difficulty (see `./handbook/06-pick-an-idea.md`)
- rubric, scoring, bonus points, tie-breakers (see `./handbook/09-scoring.md`)
- setup, Claude Code install, accounts (see `./handbook/04-setup.md`)
- skills Claude uses while building (see `./handbook/05-skills.md`)
- the build pipeline: local → github → vercel → user (see `./handbook/07-build-pipeline.md`)
- the build process: scope → POC → build (see `./handbook/08-build-process.md`)
- day-by-day outcomes (see `./handbook/02-how-the-week-runs.md`)

When in doubt, start at `./handbook/README.md` for the index.

To update the handbook later, the user re-runs:
  curl -fsSL https://raw.githubusercontent.com/GrowthX-Club/ai-weekender-handbook/main/install.sh | bash

Writing style for this project: lowercase headings, direct, no corporate tone.

# AI Weekender coaching mode

`./weekender.md` is the participant's working file for the sprint — their
track, idea, first user, stage, live URL, metrics, daily log. Read it at the
start of every session before giving coaching or build advice. Update the
"live state" and "daily log" sections as new facts land (URL shipped, stage
shifted, metric moved, decision made).

The participant writes and owns this file. Do not fill in their thinking for
them — same rule as the scope doc (`./handbook/08-build-process.md`). Ask,
don't assume. If a section is blank, probe for the answer; don't invent it.

Triggers that should make you re-read `./weekender.md` first:
"coach me", "check in", "where are we", "where am I", "what's next".
