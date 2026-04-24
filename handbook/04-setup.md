# Setup

Tick each box as you go. You're done when all 12 are green. ~30 mins total, most of it waiting.

Each step says what to do, what Claude will say back, and how to know you're done. When in doubt — ask Claude. It's literally there to help.

## Step 1 — Open your terminal. Drag it full-screen.

- **Mac:** press `cmd + space`, type `terminal`, press `enter`.
- **Windows:** press the `windows` key, type `powershell`, click **"Windows PowerShell"** (the blue one — not ISE).

Now make it full-screen. Drag the corner. Or hit the green button (mac) / maximize (windows). This is where you'll spend the next four days. **You are a builder now.**

**Done when:** a black or blue window fills your screen with a prompt like `yourname@Mac ~ %` or `PS C:\Users\yourname>`.

## Step 2 — Install Claude Code.

Paste the right command for your machine. **Mac paste:** `cmd + v`. **Windows paste:** right-click (yes, really).

**Mac:**
```bash
curl -fsSL https://claude.ai/install.sh | bash
```

**Windows (paste each line, one at a time):**
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
```
```powershell
irm https://claude.ai/install.ps1 | iex
```

**Done when:** 30–60 seconds later, the terminal scrolls a bunch of text and stops. You'll see a fresh `%` or `>` prompt at the bottom. No error in red.

## Step 2.5 · Mac only — Make Claude work from anywhere.

The installer says "installation complete" — but it's not quite done. The `claude` command is on your machine, but your terminal doesn't know where to find it yet. One paste fixes that forever.

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
```

Windows users — your installer handles this for you, skip this step.

**Done when:** the command finishes silently. No error in red.

## Step 3 — Close that terminal and open a new one.

This matters — the install added `claude` to your PATH (the list of programs your terminal knows about). Only a fresh terminal sees the new entry.

- **Mac:** press `cmd + q` on the terminal window. Then re-open it (cmd+space → terminal).
- **Windows:** close the PowerShell window with the X. Then re-open PowerShell.

**Done when:** you have a brand new terminal window open. Blank slate.

## Step 4 — Start Claude with the safety flag.

```bash
claude --dangerously-skip-permissions
```

The `--dangerously-skip-permissions` flag tells Claude it can install software for you without stopping to ask permission for every single command. Without it, you'd hit `y` fifty times. With it, Claude just gets the job done. It sounds scary — it's not. It just means Claude won't pause for confirmations during install.

**Done when:** Claude starts up. On first run it opens your browser to log in (next step).

## Step 5 — Log in to Claude in the browser.

Your browser will open a Claude page asking you to sign in. Use your **Claude Max account** — same login you use at claude.ai.

Once you're logged in, the browser will say "you're authenticated. you can close this tab." Come back to your terminal.

**Done when:** back in the terminal, you see a `>` prompt. Claude is now waiting for you to type something.

## Step 6 — Paste the big setup prompt into Claude. Press enter.

Copy **everything** inside the block below — it's long but you only paste it once. Paste it at the `>` prompt in your terminal. Press enter. Claude reads it and starts.

```
you are helping me set up my laptop for an ai weekender. i am a beginner — treat me as someone with ~zero terminal experience. be patient, explain what each command does in one short sentence before running it, and pause whenever i need to click a browser, enter a password, or type input.

how to work:
- do one numbered section at a time. don't batch.
- if a check shows something is already installed (e.g. brew, node), skip the install step and tell me it's already done.
- if any command fails, stop and ask me what's on screen. don't silently retry or improvise.
- don't install anything i didn't list below.
- when i need to interact (password, browser auth, make an account), pause and wait for me to say "done" before continuing.
- no bonus tools, no "while we're at it". stick to the list.

first: detect my OS (uname -a on mac/linux, or note you're in powershell on windows). tell me which OS you detected and which package manager you'll use (homebrew for mac, winget for windows). then begin section 1.

sections, in order:

1. package manager.
   - mac: install homebrew if missing. warn me i'll need to enter my mac login password once when it asks — and that the screen won't show characters as i type (that's normal).
   - windows: verify winget exists. if missing, stop and tell me to install "app installer" from the microsoft store.

2. core tools. install if missing, skip if present, verify each with --version, in this order: node.js LTS, python 3, git, github cli (gh).

3. git config. ask me for my name and email, then run:
   - git config --global user.name "<name>"
   - git config --global user.email "<email>"
   - git config --global init.defaultBranch main

4. accounts — pause and wait for me. THIS ORDER IS NOT OPTIONAL. say it loudly to me, exactly like this:

   "STOP. you must create these three accounts in this EXACT order, ONE AT A TIME, using the SAME email for all three. the order matters because vercel and convex both depend on github existing first. do not skip ahead. do not do them in parallel.

   FIRST — github: https://github.com/signup. create the account. confirm your email. tell me 'github done' before moving on.

   SECOND — vercel: https://vercel.com/signup. on this page you MUST click 'continue with github'. do NOT sign up with email. do NOT use google. ONLY 'continue with github'. tell me 'vercel done'.

   THIRD — convex: https://dashboard.convex.dev. you MUST click 'sign in with github'. same github account. NOT email, NOT google. tell me 'convex done'."

   if i try to do them out of order or use any other login method, stop me immediately and remind me. wait until i say 'all three done' before continuing.

5. github auth over ssh — make me open a NEW terminal tab and do it there myself. tell me literally:

   "open a new terminal tab right now. mac: press cmd+t. windows: press ctrl+t (or click the + button at the top of your terminal). this opens a fresh tab next to this one — your claude session stays running here in the original tab.

   in the new tab, type:

       gh auth login

   then press enter. follow the prompts as they appear: github.com → SSH protocol → Yes (generate new key) → empty passphrase → Login with a web browser → it shows you a one-time code → opens a browser → paste the code → authorize.

   when the new tab shows your github username at the bottom, you're done. close that tab and come back to this one. tell me 'back'."

   wait for me to say 'back'. then verify in this tab with gh auth status (should show my username) and ssh -T git@github.com (the "does not provide shell access" message is expected — it means ssh worked).

6. vercel cli + login — on mac, vercel install needs sudo and must happen in a separate terminal tab because i cannot handle password prompts. tell me literally:

   "open a new terminal tab. mac: cmd+t. windows: ctrl+t. in that new tab, type:

       sudo npm install -g vercel

   press enter. type your mac login password when prompted (characters won't show — that's normal). wait for install to finish.

   then in the same new tab, type:

       vercel login

   pick 'continue with github' in the browser that opens. authorize. come back to the new tab, wait until you see 'Success! GitHub authentication complete'. close that tab. come back to this claude tab. tell me 'vercel done'."

   (on windows, sudo isn't needed — but still do the install in a new tab to keep this session clean.)

   wait for me to say 'vercel done'. then verify in this tab with vercel whoami.

7. final verify. run on mac: node --version && npm --version && python3 --version && git --version && gh --version && vercel --version && gh auth status && vercel whoami. on windows: same but with ; separators and python instead of python3. if every line prints a version or auth status with no errors, say "setup complete" and remind me my convex account is ready but the project folder gets scaffolded at kickoff.

let's go. tell me which OS you detected, then start section 1.
```

> **Claude will say:** something like: "i detected mac OS. i'll use homebrew as the package manager. starting section 1 — installing homebrew. this needs your mac login password..."

**Done when:** Claude has read the prompt, told you which OS it detected, and started working through the steps.

## Step 7 · Mac only — Type your Mac login password.

During the homebrew install, the terminal will pause and ask for your **Mac login password** (the one you use to unlock your laptop). Type it and press enter.

**Important:** as you type, the screen won't show characters — no dots, no asterisks, nothing. That is normal. It's not broken. Just type your password and hit enter.

(Windows users: skip this step.)

> **Claude will say:** "homebrew installed successfully. moving to section 2 — installing core tools..."

**Done when:** Claude moves past homebrew and starts installing node, python, git, gh.

## Step 8 — Create three accounts in this exact order.

GitHub → Vercel → Convex. Same email.

Claude will pause at section 4. It'll tell you to do this in a strict order. **Do not skip ahead. Do not do them in parallel.** GitHub must exist first because Vercel and Convex both log in via GitHub.

1. **FIRST.** [github.com/signup](https://github.com/signup) — sign up with your email, confirm. Type `github done` in the Claude terminal.
2. **SECOND.** [vercel.com/signup](https://vercel.com/signup) — click **"continue with github"**. NOT email. NOT google. Type `vercel done`.
3. **THIRD.** [dashboard.convex.dev](https://dashboard.convex.dev) — click **"sign in with github"**. NOT email. NOT google. Type `convex done`.

Once all three say "done", type `all three done` in the Claude terminal. Claude resumes.

> **Claude will say:** "STOP. github first, then vercel (continue with github), then convex (sign in with github). same email. one at a time." — if you try to do them out of order, Claude will stop you. That's intentional.

**Done when:** you've created all three and Claude has resumed past the pause.

## Step 9 — GitHub auth. Open a NEW terminal tab.

Claude will tell you to open a fresh terminal tab so your Claude session keeps running here.

- **Mac:** press `cmd + t`.
- **Windows:** press `ctrl + t` (or click the `+` at the top of your terminal).

In that new tab, type:

```bash
gh auth login
```

Press enter. Follow the prompts as they appear, one at a time: `github.com` → `SSH` → `Yes` (generate new key) → empty passphrase → `Login with a web browser`. It'll show you a one-time code, open a browser, you paste, you authorize. When the new tab shows your GitHub username, you're in.

Close the new tab. Come back to the Claude tab. Type `back`. Claude verifies and continues.

> **Claude will say:** "github auth verified. logged in as <your-username>. moving to section 6 — vercel."

**Done when:** Claude confirms `gh auth status` shows your username.

## Step 10 — Install Vercel in a NEW terminal tab. Needs sudo on Mac.

Vercel install needs your Mac password. Claude can't handle password prompts, so open a new terminal tab yourself.

- **Mac:** `cmd + t`.
- **Windows:** `ctrl + t`.

In the new tab (on Mac):

```bash
sudo npm install -g vercel
```

Enter your Mac login password when asked. The screen won't show characters as you type — that's normal. Wait for install to finish. On Windows, drop the `sudo` — just `npm install -g vercel`.

Then, still in that new tab:

```bash
vercel login
```

Pick **"continue with github"** in the browser that opens. Authorize. Come back to the new tab. When you see "Success! GitHub authentication complete," close the tab. Come back to the Claude tab. Type `vercel done`.

**Done when:** Claude confirms `vercel whoami` shows your username.

## Step 11 — Wait for "setup complete."

Claude runs one final command that prints the version of every tool it installed (node, python, git, gh, vercel) plus your GitHub + Vercel logins. If every line shows a version with no error, Claude will say **"setup complete"** in the next message.

If Claude doesn't say that — or you see anything red or the word "error" — type `what went wrong?` and let Claude debug it.

> **Claude will say:** "setup complete. every tool is installed and logged in. your convex account is ready — the project folder gets scaffolded on kickoff day."

**Done when:** you see "setup complete" in Claude's reply.

## Step 12 · Final — Install the talking rules.

Claude Code reads a file at `~/.claude/CLAUDE.md` on every session. If you put rules in there, Claude follows them across every project. We're going to drop eight rules in there — they change how Claude talks, especially if you're a beginner.

**The rules being installed:**

1. **Plain words. No jargon.** If it uses a technical term, it explains it in the same sentence.
2. **One question at a time.** Not five. Concrete choices — "save to a file or show on screen?" not "what persistence strategy?"
3. **Say what it's about to do, before doing it.** In one line.
4. **Explain its own tools.** First time it uses a skill or subagent — one line on what that is.
5. **No false confidence.** "Haven't tested in browser yet" is honest. "Done" when it hasn't checked is a lie.
6. **Never make you feel dumb.** No "as I mentioned," "obviously," "simply."
7. **Match your energy.** You write one line, it writes one line.
8. **Push back when you're wrong.** Gently, one line, with the reason. If it only agrees, you'll ship bugs.

Paste this into your terminal. Safe to run more than once.

**Mac:**
```bash
mkdir -p ~/.claude && cat >> ~/.claude/CLAUDE.md <<'EOF'

# how claude should talk to me

1. plain words. no jargon. if it uses a technical term, it explains it in the same sentence.
2. one question at a time. not five. and the choices should be concrete — "save to a file or show on screen?" not "what persistence strategy?"
3. say what it's about to do, before doing it. in one line.
4. explain its own tools. first time it uses a skill, slash command, or subagent — one line on what that is.
5. no false confidence. "haven't tested in browser yet" is honest. "done" when it hasn't checked is a lie.
6. never make me feel dumb. no "as i mentioned," "obviously," "simply."
7. match my energy. if i write one line, write one line.
8. push back when i'm wrong. gently, one line, with the reason. if you only agree, i'll ship bugs.

## the fix
if you say something confusing, i'll type "explain that like i've only used chatgpt." rewrite it.

EOF
```

**Windows (PowerShell):**
```powershell
$p = "$HOME\.claude"; if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p | Out-Null }; Add-Content -Path "$p\CLAUDE.md" -Value @'

# how claude should talk to me

1. plain words. no jargon. if it uses a technical term, it explains it in the same sentence.
2. one question at a time. not five. and the choices should be concrete — "save to a file or show on screen?" not "what persistence strategy?"
3. say what it's about to do, before doing it. in one line.
4. explain its own tools. first time it uses a skill, slash command, or subagent — one line on what that is.
5. no false confidence. "haven't tested in browser yet" is honest. "done" when it hasn't checked is a lie.
6. never make me feel dumb. no "as i mentioned," "obviously," "simply."
7. match my energy. if i write one line, write one line.
8. push back when i'm wrong. gently, one line, with the reason. if you only agree, i'll ship bugs.

## the fix
if you say something confusing, i'll type "explain that like i've only used chatgpt." rewrite it.

'@
```

**Done when:** the command finishes silently. No error in red. Every future Claude session reads these rules first.

## If Claude gets stuck

> ⚠ **If something breaks:** type `what's wrong? show me what you see on screen.` in the terminal. Claude will explain what failed and how to fix it. If it's still stuck — ping the host channel. No dumb questions on setup day. Everyone's laptop is differently cursed.

## The escape hatch (after setup)

Once you're past setup and using Claude for the build — if anything Claude says ever feels confusing, type **"explain that like i've only used chatgpt."** Claude will rewrite it in plain words. That's your one-line fix for everything.
