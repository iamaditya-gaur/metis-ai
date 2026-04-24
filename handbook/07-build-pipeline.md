# Build Pipeline

Before you build, learn where your code goes.

Every web app moves through four places. **Your laptop** is where you try things. **GitHub** is where your code lives. **Vercel** is where it goes live. **Your user** is the point. This is the pipeline. Learn it today — you'll run it a thousand times from here.

## The loop

```
01 your mac  →  02 github  →  03 vercel  →  04 your user
   (Local)       (Cloud)        (Host)         (Public)
   where you     where it       where it       opens the
   build         lives          ships          url
       ↑                                          |
       └──── iterate: you see feedback, edit, push again ────┘
```

## 01 · Local — your mac

Your laptop. Every build begins here. You open Claude Code in your terminal, describe what you want in English, and watch it render at `localhost:3000` in your browser. Instant. There is nothing between you and the code.

- **Speed** — every edit hits your browser in under a second. **No deploy, no waiting on anyone.**
- **Privacy** — your in-progress mess — broken buttons, placeholder copy — **nobody else ever sees it.**
- **Safety** — try anything. Delete anything. **Nothing is lost because nothing has left your machine yet.**

The moment to move forward: you use what you built, and it works. You think *"yeah, I'd show this to someone."* That's your cue to push.

## 02 · Cloud — github

When a feature works on your mac and you want to keep it, you **push** it to GitHub. Three commands, thirty seconds. Or — more likely this weekend — you tell Claude *"I like what I have. Commit and push to github."* and Claude runs them for you.

GitHub is now the source of truth for your project. Not your laptop. Your laptop is a workshop. GitHub is the warehouse. Every other tool reads from here, not from your machine.

- **Versioned** — every version of your code saved forever. **Always go back to the last working one.**
- **Public flex** — first green square lights up the moment you push. **Your builder flex.**
- **Source of truth** — Vercel reads from here, not your laptop. **No GitHub, no deploy.**

## 03 · Host — vercel

This part confuses almost everyone, so read it slowly. **You do not deploy.** You push to GitHub. Vercel does the deploying — automatically, every single time, without you pressing anything.

The moment your code lands on GitHub, Vercel's servers grab it, run `npm install`, run `npm run build`, and turn your human-readable code into something every browser can load.

> **What does "build" actually mean?** Vercel takes whatever code sits on your GitHub — React components, TypeScript, CSS, images, backend routes — and packages it into optimized, minified, browser-ready files. The same thing every production site on the internet does before going live. **You do nothing here.** You push; Vercel builds; a live URL updates.

- **Real URL** — `your-project.vercel.app`. **Your mom can open it on her phone.**
- **Auto-deploy** — every push triggers a build. **No commands, no dashboards, no buttons.**
- **Fast everywhere** — cached across a global network. **Bangalore, London, New York — same latency.**

If the build succeeds, your site is live in under a minute. If it fails, Vercel emails you and the old version stays up. Your users never see a broken site.

## 04 · Public — your user

This is where the loop starts paying back. Someone opens your URL on their phone, sees your product, signs up, sends it to a friend.

Everything else — the stack, the pipeline, the three commands — is plumbing. **If a user can't open your URL, nothing you built matters.** If they can, every signup is your first real proof that you built something real.

- **The only test** — can they open your URL? **Yes = real. No = doesn't exist.**
- **First proof** — every signup is a rubric point. **A stranger signing up is the moment you showed up for.**
- **The point** — everything else — stack, pipeline, commands — is plumbing. **This is what you ship for.**

## Go live — one sentence. Claude does the rest.

You don't need a recipe. Claude already knows the pipeline — you just read it. Claude already knows you're in a hackathon — your `CLAUDE.md` says so. When your local version feels worth shipping, tell Claude what you want, in your own words. Something like:

> *"ship this to vercel. set up github and vercel from scratch and make it auto-deploy. ask me the repo name and whether it's public."*

Claude runs `git init`, writes a sane `.gitignore`, creates the GitHub repo, pushes, wires Vercel, fires the first deploy, and prints the live URL at the end. It'll pause twice — repo name, public/private — because those are your decisions.

> **What this one sentence unlocks:** after this runs once, the chain **your mac → github → vercel** is permanent. Every future push triggers a deploy automatically. No dashboards. No uploads. No buttons. That's the whole reason we do this once.

## Every push after — three commands. Or one sentence.

The three commands, for the record:

```bash
git add . && git commit -m "what changed" && git push
```

Or just tell Claude: *"I like where we're at. Commit and push."* It writes the message, runs all three, reports back with the live URL. Do it that way for a week — the muscle memory wires itself in.

## When builds fail — one line fixes almost everything

Build failures will happen. **Don't open the Vercel dashboard. Don't hunt through logs.** Claude already knows how — it can hit the Vercel API on your behalf.

Tell Claude Code:

```
my vercel build just failed. use the vercel api to pull the latest deployment's build log, find the actual error, and fix it. when you're confident the fix will build, push it.
```

Same one-line approach for every other infra problem:

- **Push rejected?** *"my push was rejected. pull the latest and push my work."*
- **Env var missing?** *"the build log says an env var is missing. add it to vercel via the api."*
- **Site returning a 500?** *"my live site is showing an error. pull the vercel runtime logs and fix whatever broke."*
- **Deploy stuck?** *"my deploy has been pending 10 min. check status via the api and redeploy if needed."*

You used to need to *know how to use Vercel*. Now you just need to know what you want. **Claude reads the tools on your behalf.**

## The takeaway

**One pipeline. Every app. For the rest of your life.**

Every time you change anything: **edit on your mac → push to github → vercel deploys → your user sees it.** No shortcut skips GitHub or Vercel. Every professional engineering team on earth runs exactly this pipeline — just with more people standing around it.

You're one of them now.
