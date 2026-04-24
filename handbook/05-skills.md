# Skills

Install 6 skills. Claude follows them automatically.

Skills are instruction packs your coding agent reads when a relevant task comes up. Installing the React skill means Claude follows React performance rules without you ever asking. Installing the design skill means it stops giving you generic purple-gradient AI-looking UI. Install once, then build all weekend. ~5 minutes.

> ⚠ **Do this on kickoff night, not now.** Skills install into the folder you run the command from. You don't have a project folder yet — that gets scaffolded on Wednesday at kickoff. Come back to this page once you've created your project folder and you're inside it. `cd` into your project, then start step 1 below.

## The 6 skills

Each one is a small file Claude reads when it's relevant. They sharpen the output across different parts of building.

### vercel-react-best-practices
64 performance rules for React / Next.js. Bundle size, rendering, data fetching, re-render optimization. Claude follows them silently when you write React.

### frontend-design
Pushes Claude toward distinctive UI. Avoids the generic "AI-looking" defaults — purple gradients, Inter font, cookie-cutter layouts. Your product stops looking like every other vibe-coded thing.

### writing-plans
Claude drafts a plan before writing code for anything non-trivial. Catches bad ideas before they become bad code. Quality jumps a lot.

### convex-setup-auth
Scaffolds a Convex backend with authentication so you don't build user login from scratch. Login, signup, sessions — done.

### interface-design
UI / UX patterns and component-level design guidance. Makes Claude think about hierarchy, spacing, contrast — not just "make a button".

### copywriting
Better landing page copy, headlines, marketing text. When you say "write the hero copy," it stops sounding like every other startup landing page.

## Step 1 — Open your terminal. `cd` into your project folder.

Skills install into the folder you run the command from. So first, get inside your project folder.

If you scaffolded your project at kickoff, it's probably called something like `my-weekender-project`. Type:

```bash
cd my-weekender-project
```

**Done when:** your terminal prompt shows you're inside the project folder.

## Step 2 — Start Claude with the safety flag, inside this folder.

```bash
claude --dangerously-skip-permissions
```

Same flag as before — Claude installs the skills without stopping to ask permission for every command. You'll see the `>` prompt. Claude is ready.

**Done when:** Claude is running and waiting for your input at the `>` prompt.

## Step 3 — Paste this prompt. Claude installs all 6.

Copy the whole block, paste at the `>` prompt, press enter.

```
install the following 6 weekender skills. run each command in order, confirm success after each, and summarize at the end.

1. npx --yes skills add https://github.com/vercel-labs/agent-skills --skill vercel-react-best-practices
2. npx --yes skills add https://github.com/anthropics/skills --skill frontend-design
3. npx --yes skills add https://github.com/obra/superpowers --skill writing-plans
4. npx --yes skills add https://github.com/get-convex/agent-skills --skill convex-setup-auth
5. npx --yes skills add https://github.com/dammyjay93/interface-design --skill interface-design
6. npx --yes skills add https://github.com/coreyhaines31/marketingskills --skill copywriting

after all 6 finish, run `ls .claude/skills/` and confirm all 6 folders exist.
```

> **Claude will say:** "running install 1 of 6 — vercel-react-best-practices... installed. running 2 of 6..." It works through them one by one. Takes a couple of minutes total.

**Done when:** Claude says all 6 are installed and `ls .claude/skills/` shows 6 folders.

## Step 4 — Restart Claude. Skills don't load until you do.

This step is required. Skills are read once when Claude starts — they won't activate in the session you just installed them in.

Type `/exit` in the Claude prompt and press enter. You're back at your terminal. Then start Claude again:

```bash
claude --dangerously-skip-permissions
```

**Done when:** you have a fresh Claude session running in the same project folder.

## Step 5 — Verify. Type `/skills` and look at the list.

At the Claude `>` prompt, type `/skills` and press enter. Claude shows you every skill it has access to.

You should see all 6 listed:

- `vercel-react-best-practices`
- `frontend-design`
- `writing-plans`
- `convex-setup-auth`
- `interface-design`
- `copywriting`

If any are missing, run `ls .claude/skills/` in a new terminal tab to confirm the folders exist. If a folder is missing, the install for that one failed — re-run just that line.

**Done when:** all 6 skills show up in the `/skills` list.

## Step 6 · Final — Ask Claude what skills it has.

Quick sanity check. Type:

```
what skills do you have?
```

Claude should list them and tell you what each does. If it does — you're good. You can now build with all 6 skills active in the background.

**Done when:** Claude confirms it knows about all 6 skills. You're ready to build.

## How to invoke skills while building

Skills will often activate automatically when relevant. But naming them explicitly gives you more reliable results.

**1. Slash command.** Type `/` inside Claude Code, pick the skill from the list, or type the name:

```
/frontend-design build a waitlist page for my product
```

**2. Just mention it.** Plain English works too:

```
follow vercel-react-best-practices and review this page.
```

## Troubleshooting

> ⚠ **`npx: command not found`** — Node.js is missing. Go back to the setup page and re-run the Claude install — it pulls Node down with it. Then reopen the terminal.

> ⚠ **`permission denied` on Mac** — prefix the command with `sudo`. Enter your Mac password when asked. The screen won't show characters as you type — that's normal.

> ⚠ **`permission denied` on Windows** — close PowerShell. Reopen as administrator (right-click PowerShell → "run as administrator"). Re-run the install.

> ⚠ **Command hangs for more than 2 minutes** — cancel with `ctrl + c`. Re-run that one line. It's probably a flaky network — try once more before panicking.

> ⚠ **Skill installed but Claude doesn't see it** — you forgot to restart. Type `/exit` and start `claude --dangerously-skip-permissions` again from the project folder.

> ⚠ **Repo not found / 404** — the skill URL may have moved. Ping the host channel and we'll send you the new one.

**Browse more skills:** [skills.sh](https://skills.sh)
