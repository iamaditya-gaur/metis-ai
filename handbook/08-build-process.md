# Build Process

How to actually build with AI.

This is the most important page in the handbook. Read it twice. Slowly. Don't worry if some of it looks like Chinese right now — by Sunday it will feel obvious. But if you skip a step here, no one can save you. Not Claude, not the team, not anyone. So: **scope. Then POC. Then build. Always.**

## The shape — every product has three layers

Doesn't matter if you're on Virality, Revenue, or MaaS. Doesn't matter if you're building a dating-profile reviewer or a B2B SaaS. Every single product you will ever build breaks into the same three layers. If you can see the three layers, you can build anything.

### 1. Frontend — the interface

What the user sees and clicks. The buttons. The input fields. The upload box. The screens. This is the "face" of the product.

### 2. Backend + database — the brain and the memory

The logic that runs when the user clicks. The data that gets stored — who came, what they did, what they got back. This is the "thinking" and the "remembering".

### 3. Third-party integrations — outside help

AI models like Claude or GPT-4. Stripe for payments. Resend for email. Anything you don't build yourself — you just plug in.

### Example — the viral dating-profile reviewer

Let's make this concrete. A real product people actually build. You upload screenshots of your dating profile, AI tells you honestly what a girl would think. Here's how it maps:

- **Frontend.** A simple page. A big upload button. "Drop your profile screenshots here". A submit button. A results area below.
- **Backend + database.** When the user clicks submit, the server takes the images, converts them, runs them through a prompt — "you are reviewing a dating profile. look at authenticity, trust, vibe. what would a girl actually think? give honest feedback." It stores the user, the images, and the feedback in the database so they can come back and see their history.
- **Third-party.** Claude (or GPT-4 Vision) does the actual looking and thinking. You didn't build that brain. You just used it.

That's the whole product. Three layers. Wired together. Once you see this shape, you will see it in every app you use — Instagram, Zomato, LinkedIn, Notion. Same three layers. Different flavour.

## The principle — the scoping document is the most important thing you do

Before you write a single line of code. Before you open Claude Code. Before you ask AI for anything. **You write a scoping document.** By hand. In plain English. About your user.

> ⚠ **You write it. Not the AI.** If you ask the AI to write your scope, it shows immediately. The output comes out backwards. The AI doesn't know your user. You do. This is the one part that cannot be outsourced.

### What goes in it

Think about your user, step by step. Literally imagine them sitting at their laptop:

- What's the first screen they land on?
- What do they click?
- What do they type or upload?
- What happens when they hit submit?
- Where does that data go?
- What do they see back? In what format? How fast?
- What's the second screen? The third?
- If they come back tomorrow, what do they see?

Walk through **every user journey** end to end. Sign-up journey. Core-action journey. Return journey. Edge cases. That full document is your spec. That document is what AI builds from.

> **Step 1, step 2, step 3 — like school maths.** Remember in school when you tried to skip a step in a maths problem because you "could do it in your head"? And you got the answer wrong? Same thing here. Do not be over-smart. Do not skip. Every user click. Every screen. Every data write. Written down. If you skip a step, no one can save you. Not Claude. Not the team.

## The discipline — POC before build. Always.

Okay, you have a scoping document. You are excited. You want to open Claude Code and tell it to build the whole thing. **Don't.** Not yet. First you build a tiny POC — a proof of concept — *inside Claude itself*. No code. No deployment. Just the prompt and the output.

### Example — POC'ing the dating reviewer

You scoped it. You know the core logic is: "look at these profile images and give honest feedback like a real girl would." That's the brain of the product. Everything else — the upload button, the database, the results screen — is just wrapping paper around that brain.

- Open Claude (the chat, not Claude Code).
- Paste your prompt: "you are a 25-year-old woman on hinge. i'm going to show you 3 screenshots of a guy's profile. tell me honestly — authentic or fake? trustworthy or sus? would you swipe right? be brutal, not polite."
- Attach 3 real sample profiles.
- Read the output. **Is the feedback actually good? Is it specific? Is it the tone you wanted?**

If yes — refine the prompt until it is razor sharp. *Then* you go to build. If no — good, you just saved yourself two days. Because if the brain doesn't work, the product will not work. No UI is going to save a broken brain. Fix the prompt **first**.

> **You are the manager. AI is the intern.** This is the mindset shift. The intern is fast, tireless, and never complains — but has no taste. Your job is to give the intern a clear spec and check their work. The POC step is where you check the work *before* you scale it. You look at the output and decide: is this right or is this wrong? Don't doubt yourself. Trust your eye. If it sucks, say it sucks. That's your job as the manager.

## The process — three steps, in order, no skipping

### 1. Scope

You write the scoping document yourself. Every user journey. Step by step. Like school maths. Don't skip.

### 2. POC

Validate the core brain inside Claude chat. Get the prompt sharp. If the POC output is bad, do not build.

### 3. Build

Now — and **only** now — you let Claude Code build the product. With a clear scope and a validated prompt, the build is the easy part. Trust me.

Scope. Then POC. Then build. Always. This is the rhythm. Memorise it. When you feel lost on Friday night at 2am, come back to this rhythm. It works every time.

## The stack — four tools you'll actually use

That's it. Don't worry if the names look like Chinese right now — by Saturday they'll feel like old friends. Here's what each one does, in plain English:

### `claude code`

The AI that writes the code. You type what you want in English — *"build me a waitlist page with a headline and an email field, ship it"* — and Claude writes it. Runs in your terminal. This is where you spend most of your weekend.

### `convex`

Your database + backend in one place. Where data lives (Udayan signed up at 7pm and got this feedback) and where server logic runs (prompts, AI calls, saving). Claude already knows how to wire it. You won't feel the seams.

### `vercel`

Where you ship. Turns your code into a live URL like `your-app.vercel.app`. Your mom can open it on her phone. Auto-deploys every time you push. That's what "live" means.

### `github`

Where your code lives. Every change gets pushed here. **By Sunday you'll have a public GitHub profile with your first green commit graph.** Most people in marketing, product, business never get this. You will. Show your friends.

## The target — what you need to submit, by when

Every track — Virality, Revenue, MaaS — has its own scoring rubric. You'll see it on the Scoring page. The realistic target for most of you looks like this:

### Thursday midnight — some params at L2

Not all. Some. For most tracks, L2 = **a waitlist landing page live on the internet + a public launch post out**. That's it. That's the Thursday bar.

### Friday — push to L3

Now you wire the actual product flow. The real thing people will use. Upload → process → result. Sign-up → core action → return.

### Saturday 8pm — final submission

Keep racking points through Saturday. Polish. Fix. Launch louder. Final submission closes at 8pm sharp.

### The simplest path to L2 by Thursday

If you have never touched code before, here is the dead-simple Thursday move: **a waitlist landing page**. One screen. A sharp headline. A bulleted list of what you're building. An email field. A submit button. That's L2.

You open Claude Code and say something like this:

```
i'm building [company name]. it helps [who] do [what].
the headline is: "[your sharp one-liner]".
below the headline, three bullet points: [feature 1], [feature 2], [feature 3].
then an email input and a "join waitlist" button that saves the email to convex.
clean design, lots of whitespace, one accent colour.
ship it to vercel when it's ready and give me the live url.
```

That's the prompt. Claude Code does the rest. You'll have a real live URL in under an hour. Share it in your launch post. That's Thursday done. Friday you go deeper — you build the actual product behind the waitlist. The one you scoped. The one you POC'd. The real thing.

> **One last thing before you go build.** You are not here to become an engineer in four days. That's not the point. You are here to become the person who can **scope a product, validate the core, and ship something real to the open internet.** That's the move. Once you've done it once, you can do it every weekend for the rest of your life. So — scope. POC. Build. Don't skip. Trust your eye. Manage the intern. Ship by Saturday 8pm. Go.
