# Pick an idea

Pick one in ten minutes. Build it. If you're still browsing at 11:30, pick the easiest one that caught your eye.

## This is an idea bank — not a required menu

**Bring your own idea. We just want it to fit one of the three tracks.**

These ideas exist because most builders waste their ideation window. If something on this list clicks, use it. If you came in with your own idea, build *that* instead. The only requirement: your project has to fit one of the three tracks — that's the rubric you'll be scored on.

## The three tracks

- 🎯 **Virality** — the project's edge is how it spreads
- 💰 **Revenue** — the project earns real money in the sprint
- 🤖 **MaaS (Multi-Agent-as-a-Service)** — the project replaces an agency or team with agents

## Lean into your strengths

Pick the track where you already have an unfair advantage. Four days is too short to build a track-specific edge from zero. Use what you already have. Where you've put in the reps matters more than which track looks cool.

### 🎯 Virality — if you have a cool idea you know will spread, or you've watched something go viral and thought hard about why

A following helps but does **not** matter. Virality is not about followers. It's about the idea and the way you write the copy. Specific, funny, uncomfortably accurate — something the first 10 viewers send to five more. If you have ever read a viral post and thought "I could write that," this is your track.

### 💰 Revenue — if you have deep expertise in an industry and can build a small revenue feature in two days flat

You know an industry inside-out — operators, decision-makers, real workflows, real spend. You can name a small painful problem in that industry where someone would pay tomorrow if a working tool existed. That ASAP-revenue instinct is the edge. Not a network. Not a sales pipeline. Pattern recognition + a two-day shippable wedge.

### 🤖 MaaS — if you are already very technical. This is the hardest track. Pick it only if you can take the heat.

MaaS means replacing an entire agency or team with agents — researcher, writer, editor, publisher; or analyst, redliner, communicator. Many roles. Many failure modes. Real orchestration. You should already be comfortable with agent workflows. **If you're not technical yet, do not pick MaaS.** Pick Virality or Revenue and ship.

> **Not sure?** Default to Virality or Revenue. They are the right choice for almost everyone. MaaS is the hard road — only choose it if you already know your way around agent systems.

## Honest difficulty

**Starter** isn't "easy" — it's "buildable in the time with clear scope." **Beast Mode** isn't "you should pick this" — it's "you might not finish and that's fine." Pick the one you can demo in 3 minutes, not the one that sounds most impressive on paper.

---

# 🎯 Virality ideas

## Starter

### 01. The Excuse Machine

**Difficulty**: Starter · **Track**: Virality
**Pitch**: Paste your wasted day, get a corporate standup update.
**Why starter**: Single input (text paste), one API call for translation, clean before/after UI.
**User story**: As a remote engineer who just spent six hours doom-scrolling, I paste "watched YouTube, ate two sandwiches, started a PR and quit" into a box and get back "Continued alignment on Q2 infrastructure initiatives, completed dual nutrition checkpoints, progressed delivery on open PR workstream" — which I paste into Slack standup at 10:59.
**What you'll need**:
- Next.js or plain React single-page app
- OpenAI or Anthropic API with a strict system prompt
- Structured output (JSON) for bullet list format
- Two-column before/after layout with copy button
- Preset prompt styles: standup, LinkedIn, manager update

**Demo moment**: Paste a humiliatingly honest day on stage, hit generate, the room reads the corporate translation out loud and laughs because every one of them is going to use it tomorrow.

### 02. The Jargon Translator (Reverse)

**Difficulty**: Starter · **Track**: Virality
**Pitch**: Normal English in, escalating corporate nonsense out.
**Why starter**: One input, one output, 10 levels of transformation. Minimal moving parts.
**User story**: As someone who has to send the same email ten times, I type "we should talk about the deadline" and drag a slider from 1 to 10. Level 3 gives me "circling back on timeline alignment", level 10 gives me "want to socialize pre-mortem considerations around velocity headwinds this sprint".
**What you'll need**:
- React + a slider component (shadcn/ui or plain range input)
- LLM API with 10 calibrated prompt variants
- Debounced on-slide translation to avoid spam
- Copy-to-clipboard + share-as-image using html-to-image
- Local cache so replays of the same slider position are free

**Demo moment**: Drag the slider live on stage from 1 to 10. Each level escalates into more absurd corporate-speak and the audience reacts louder with every notch.

### 03. LinkedIn Post to Actual Code

**Difficulty**: Starter · **Track**: Virality
**Pitch**: Paste a LinkedIn humble-brag, see the probable reality.
**Why starter**: Text in, roast out. Single API call with structured output. The comedy carries it.
**User story**: As someone tired of "I just 10x'd our team's velocity using AI" posts, I paste one in and get back a dramatized git log: commit 1 "added console.log", commit 2 "removed console.log", commit 3 "merged with conflicts, resolved by accepting theirs". Plus the real PR description: "changed button color".
**What you'll need**:
- Text paste input + LinkedIn URL scraper fallback
- LLM with structured output (commits array + PR summary)
- Monospace terminal-style UI for the fake git log
- Shareable result image generator
- Rate limiter so you can roast one post per minute

**Demo moment**: Paste a real LinkedIn post from a famous VC, hit go, the room watches the real git log appear and cackles at how close it probably is.

### 04. Your GitHub as a Dating Profile

**Difficulty**: Starter · **Track**: Virality
**Pitch**: GitHub username becomes a dating profile with personality analysis.
**Why starter**: GitHub API → personality mapping → card generator. Linear pipeline, no branching logic.
**User story**: As a dev who types my GitHub username, the app pulls my last 50 commits, top languages, commit times, and repo names, then generates a Tinder-style card: "Gautam, 26, writes Python at 2am, commits aggressive refactors on weekends, red flags: 47 unmaintained forks, green flags: consistent tests. Looking for: someone who won't touch the .env file."
**What you'll need**:
- GitHub REST API (no auth needed for public profiles)
- Aggregator that pulls commits, repos, languages, activity hours
- LLM prompt that maps activity patterns to personality traits
- Dating-app-card UI component with photo from Gravatar
- Downloadable PNG share card via html-to-image

**Demo moment**: Type a judge's GitHub username on stage. Their dating profile renders in 4 seconds and the room can't believe how accurate "commits angrily on Sundays" is.

### 05. The Feature Creep Monster

**Difficulty**: Starter · **Track**: Virality
**Pitch**: Add features to a spec, watch a monster grow and consume the page.
**Why starter**: Frontend-only. Canvas + state machine. No APIs, no backend. Pure creative build.
**User story**: As a PM pretending to be a founder, I type a feature into a box: "user login". A cute little creature appears. I add "OAuth, dark mode, admin panel, notifications, analytics, billing" and the monster grows extra limbs, eyes, tentacles with each one, eventually consuming the entire page while a counter tracks estimated dev-hours.
**What you'll need**:
- Canvas or SVG rendering with procedural monster generation
- Text input that appends to a feature list on enter
- Physics/animation library (p5.js, rive, or Framer Motion)
- Feature-to-body-part mapping dictionary
- Local state only, no backend

**Demo moment**: Add ten features live on stage. The monster outgrows the viewport, starts eating the nav bar, a little speech bubble says "we need a rewrite" and the engineers in the audience nod slowly.

### 07. The World's Worst Tech Support Bot

**Difficulty**: Starter · **Track**: Virality
**Pitch**: Intentionally terrible support bot that's too accurate.
**Why starter**: Chat UI + LLM prompted to be unhelpful. State machine for hold/transfer/close. Light build, comedy carries it.
**User story**: As a user with a real problem, I type "my order didn't arrive". The bot replies "Have you tried restarting your router?" I say no. It says "Please hold while I transfer you." Elevator music plays. Thirty seconds later: "Your ticket has been auto-closed as resolved. Please open a new ticket for further assistance."
**What you'll need**:
- Chat UI (shadcn or plain React)
- LLM with a heavily constrained "be unhelpful" system prompt
- State machine: greet → irrelevant question → hold → transfer → close
- Web Audio API for hold music loop
- Fake ticket number generator with a "your call is important" banner

**Demo moment**: Live chat with the bot on stage asking for a refund. It puts you on hold, music plays, you wait, it closes the ticket. The room groans and then claps.

### 50. Founder Archetype Quiz

**Difficulty**: Starter · **Track**: Virality
**Pitch**: Ten questions. Tells you which Indian startup founder you really are.
**Why starter**: One form, twelve outcome cards, one share image — the whole app is a decision tree and a canvas render.
**User story**: As Ananya, a 24-year-old PM in Bengaluru, I take the quiz at 11pm, get 'You are a Deepinder Goyal — chaotic poster, ruthless operator,' screenshot the verdict card, and post it to my WhatsApp close friends. Three founders DM me the link by morning.
**What you'll need**:
- Claude — writes the 12 archetypes and scoring logic
- Convex — stores answers and tallies archetype leaderboard
- shadcn — clean quiz UI with progress bar
- satori + og-image — renders the shareable verdict card as PNG
- Vercel — deploys the share URL with OG preview

**Demo moment**: Presenter takes the quiz live, lands on 'Bhavish Aggarwal — will fight you in the comments,' and the room groans in recognition.

### 51. Roast My Pitch Deck

**Difficulty**: Starter · **Track**: Virality
**Pitch**: Upload a deck. Get a savage VC-style roast in 60 seconds.
**Why starter**: One PDF input, one Claude prompt, one shareable roast card. No auth, no dashboard, no retention loop.
**User story**: As Karan, a second-time founder in Gurgaon, I upload my seed deck at 2am and Claude hits me with 'Slide 4 says TAM is ₹80,000Cr — you calculated this by multiplying India population by a vibe.' I paste the roast into our WhatsApp group and the team can't stop laughing. I fix slide 4 the next morning.
**What you'll need**:
- Claude — reads the deck and writes the roast in Harj Taggar voice
- pdf-parse — extracts slide text
- Convex — stores roasts for the public leaderboard
- satori — renders the roast as a shareable black card
- Vercel — hosts the uploader and OG previews

**Demo moment**: A volunteer uploads their real deck on stage. Claude calls slide 7 'a pie chart about vibes' and the founder covers their face laughing.

### 53. Startup Salary Flex Card

**Difficulty**: Starter · **Track**: Virality
**Pitch**: Enter your CTC. Get a card ranking you against your batch.
**Why starter**: One number in, one card out, one leaderboard. No profiles, no chat, no DMs.
**User story**: As Aditya, a 2022 IIT-Bombay grad working at a Series B in Bengaluru, I enter ₹42L and the card says '73rd percentile for your batch — 31 people make more.' I post the card to my batch WhatsApp group, three friends reply with theirs, and the leaderboard hits 1,200 entries by Monday.
**What you'll need**:
- Convex — stores anonymous entries, computes percentiles live
- Claude — writes the snarky one-liner for each bucket
- satori — renders the percentile card as PNG
- shadcn — one-form-one-card layout
- Vercel — deploys with OG share previews

**Demo moment**: Presenter enters a plausible ₹28L. Card returns '41st percentile — your MBA friends are winning.' Whole room reaches for phones.

## Challenging

### 08. Startup Idea Graveyard

**Difficulty**: Challenging · **Track**: Virality
**Pitch**: Drop an idea, find every dead company that tried it.
**Why challenging**: Multi-source search (Crunchbase, ProductHunt, web scraping), cause-of-death analysis, visual graveyard generation.
**User story**: As a first-time founder about to pitch my startup, I type "Uber for laundry" and see a dark graveyard scene with twelve tombstones. Each one is a dead company: Washio (2013-2016, "unit economics"), FlyCleaners, Rinse, Prim. Hovering shows burn rate, funding raised, and the founder's last tweet.
**What you'll need**:
- Crunchbase API or scraped dead-company lists
- ProductHunt API + web search for cause-of-death articles
- LLM to synthesize each post-mortem into one line
- Canvas/SVG graveyard scene with hover tooltips
- Optional: final founder tweet scraped from Twitter/X archive

**Demo moment**: Type "social network for dogs" live. Nine tombstones appear with dates and causes of death. Click one to see the founder's last "we're pivoting!" tweet from 2019.

### 09. GitHub Wrapped (Any Time)

**Difficulty**: Challenging · **Track**: Virality
**Pitch**: Spotify Wrapped-style experience for any GitHub profile.
**Why challenging**: Multiple GitHub API calls, data aggregation across repos/commits/PRs, animated card generation.
**User story**: As a dev entering my GitHub username, I get pulled into a scrolling Spotify-Wrapped-style experience: "You wrote 47,231 lines this year. Your most productive hour was 2am. Your top language was TypeScript. Your longest streak was 19 days. Your most-opened file: authContext.ts. You ranked in the top 3% of your followers."
**What you'll need**:
- GitHub GraphQL API for commits, PRs, languages, stars
- Data aggregation layer computing yearly stats
- Framer Motion or Lottie for scroll-snap animated cards
- Shareable branded PNG export per slide
- Rate-limit handling + caching by username

**Demo moment**: Enter a judge's username. The wrapped plays full-screen with animated transitions. Last card shows "you fixed 213 bugs" and the judge whispers "how does it know."

### 10. AI Sports Commentator for Anything

**Difficulty**: Challenging · **Track**: Virality
**Pitch**: Live commentary on any screen activity in any commentator style.
**Why challenging**: Screen capture + vision AI + TTS. Real-time pipeline with multiple integration points.
**User story**: As a person trying to focus, I share my screen and pick "Cricket commentator". I start writing an email. A hyped voice says "He's typed the greeting! Bold choice, Dhoni would be proud! Oh no, he's deleted it! What drama!" I switch to "David Attenborough" and it goes "the engineer approaches the subject line with patient hesitation."
**What you'll need**:
- getDisplayMedia for screen capture, sampled every 2-3s
- Vision model (GPT-4 Vision, Claude, or Gemini) to describe activity
- Commentator-style prompt library (cricket, F1, Attenborough, WWE)
- ElevenLabs or OpenAI TTS with matching voice presets
- Audio queue manager so lines don't overlap

**Demo moment**: Share the demo laptop's screen. The app cricket-commentates your cursor's every move for 60 seconds. Switch to Attenborough mid-demo and the room loses it.

### 11. Terminal Horror Game

**Difficulty**: Challenging · **Track**: Virality
**Pitch**: Browser terminal where you debug a haunted server at 3 AM.
**Why challenging**: Custom shell interpreter, virtual filesystem, horror state machine, dynamic narrative generation.
**User story**: As a player, I land in a fake bash terminal. "ls" shows corrupted file names. cat reveals log lines that shouldn't exist. ps aux shows a process I didn't start. Slowly the prompt itself starts lying to me. I grep for evidence and the grep output has my own name in it.
**What you'll need**:
- xterm.js or custom terminal component for the in-browser shell
- Virtual filesystem with scripted story beats (JSON tree)
- Shell interpreter supporting ls, cat, grep, ps, kill, vim
- Horror state machine that corrupts output over time
- LLM for dynamic dialogue when player explores unexpected paths

**Demo moment**: Play two minutes live. Cat a log file. A line appears that says "I see you typing this." The audience goes silent, someone in the back laughs nervously.

### 16. "Am I Getting Scammed" Checker

**Difficulty**: Challenging · **Track**: Virality
**Pitch**: Paste a freelance gig or client email, get a red-flag analysis.
**Why challenging**: Red flag pattern detection across multiple dimensions (scope, rate, IP terms), web reputation cross-referencing, severity scoring.
**User story**: As a freelancer who just got a "build me an Uber clone for $400, equity available" DM, I paste it in. The app highlights six red flags: rate 94% below market, scope creep, vague IP clause, company has no website, sender's LinkedIn is 12 days old. Severity: 9/10. Verdict: ghost them.
**What you'll need**:
- LLM for red-flag classification across scope/rate/IP/timeline
- Web search API to verify company existence and rep
- Market-rate lookup via scraped freelance rate reports
- LinkedIn profile-age heuristic (via URL or manual paste)
- Severity scoring component with color-coded highlighting

**Demo moment**: Paste a real scammy DM from the builder's inbox. Six red flags pulse red, severity score hits 9/10, verdict card says "RUN" in monospace. Every freelancer in the room nods.

### 17. Open Source Matchmaker

**Difficulty**: Challenging · **Track**: Virality
**Pitch**: GitHub profile analysis matched to open issues where your skills fill a gap.
**Why challenging**: Skill extraction from repo analysis, issue requirement parsing, maintainer responsiveness scoring, matching algorithm.
**User story**: As a dev who wants to contribute but never knows where, I paste my GitHub username. The app scans my repos, finds I write Rust + have experience with async I/O, then surfaces five issues: "tokio#2341: needs benchmark", "ripgrep#1892: panic on --help" with maintainer responsiveness scores and estimated difficulty.
**What you'll need**:
- GitHub API to pull user repo skills (languages, frameworks, depth)
- LLM embedding of skill profile
- Issue crawler across top 1000 active repos matching those skills
- Maintainer responsiveness score from issue comment intervals
- Match ranking by skill fit × responsiveness × issue freshness

**Demo moment**: Enter a judge's username. Five matching issues appear in 20 seconds with maintainer response time ("~14 hours") and a one-line reason for each match. One of them has already been PRed by the time they get home.

### 23. Dependency Roulette

**Difficulty**: Challenging · **Track**: Virality
**Pitch**: Remove a package, replace with AI-generated custom code for only the functions you use.
**Why challenging**: Static analysis of actual import usage, replacement code generation, test suite execution as verification, multi-package interaction analysis.
**User story**: As a dev with a bloated package.json, I paste my project path. The app finds I import 4 functions from lodash out of 300, suggests replacing it, generates those 4 functions locally, runs my test suite, confirms all green, and shows me bundle-size savings: 72kb → 0.8kb.
**What you'll need**:
- AST parser (ts-morph, babel) to find actual import usage
- LLM code generation with project-style matching
- Sandboxed test runner (Docker or Deno) for verification
- Bundle size diff via esbuild metafile
- Per-package safety tier (stdlib-adjacent = safe, crypto = no-touch)

**Demo moment**: Open the app on a real project. Click "replace lodash", watch the test suite run, see the bundle-size savings. The frontend engineers in the room are already thinking about their build.

### 24. Rubber Duck Debugger (Literal)

**Difficulty**: Challenging · **Track**: Virality
**Pitch**: Animated duck that listens to you explain bugs and detects when you answer your own question.
**Why challenging**: Speech-to-text, contextual question generation, self-answer detection via NLP, animated character with reactive states.
**User story**: As a dev stuck on a bug, I talk to an animated duck. I ramble for two minutes. Mid-sentence I say "wait, the state isn't getting reset..." The duck's eyes widen, a little bubble says "You got it." It transcribes my monologue into a numbered list showing the exact moment I solved it.
**What you'll need**:
- Web Speech API or Whisper for transcription
- LLM that tracks problem-setup vs breakthrough semantic shifts
- Animated duck via Lottie or Rive with reactive states
- Contextual question generator ("why does that matter?")
- Export of the conversation as a numbered debug log

**Demo moment**: Talk to the duck on stage about a fake bug. Mid-ramble, you say "oh" — the duck's eyes pop. A bubble appears: "That's it." The room laughs because every dev has lived that moment.

### 45. Dateability Index Map

**Difficulty**: Challenging · **Track**: Virality
**Pitch**: Crowd-sourced social vibe of neighborhoods — no ratings, only patterns.
**Why challenging**: Mapbox + Convex aggregation + 3 prompts. No auth, no profiles, no moderation nightmare.
**User story**: As a 26-year-old who just moved to HSR Layout, I tap my block, answer 4 prompts in 20 seconds, and see it tagged 'high social energy, mostly young professionals, low-effort dating scene' — then I open Koramangala and argue with my flatmate about whether that's accurate.
**What you'll need**:
- Mapbox GL JS — locality polygons with vibe-tag overlays
- Convex — anonymous submissions keyed by H3 hex cell
- Claude — turns raw prompt responses into human vibe-tag summaries
- H3 spatial indexing — aggregate without revealing individuals
- No-login shadcn sheet — 3 prompts, 15 seconds, done

**Demo moment**: Pan to the audience's own neighborhood live on stage, tap it, watch the vibe tags load — the room erupts because one local area is tagged 'closed-off, corporate, high-effort' and three people immediately want to contest it.

### 46. Real Cost of Living Map

**Difficulty**: Challenging · **Track**: Virality
**Pitch**: Street-level live prices from citizens. Onions to rent, pinned in 10 seconds.
**Why challenging**: One form, one mutation, one map layer. Claude handles noisy text into clean categories.
**User story**: As someone who just paid ₹40/kg for onions, I drop a pin outside my vendor, tag 'onions ₹28/kg', and 40 minutes later see three nearby pins confirming mine while the market 600m away is pinning ₹52/kg — I text my mom a screenshot.
**What you'll need**:
- Mapbox heatmap — price deltas rendered as color gradients per item
- Convex — timestamped price entries with 7-day decay weighting
- Claude — normalizes "1kg pyaaz" / "onion 1 kilo" into one canonical item
- Expo-camera-style photo upload — optional proof shot, stored in Convex file storage
- Sub-10-second submission flow — item, price, submit

**Demo moment**: Zoom into one 2km stretch of the demo city, toggle 'tomatoes' — a visible price cliff appears between two markets across the road, and the presenter says 'this stretch is 31% cheaper, nobody knew.'

### 47. Scam & Rip-off Heatmap

**Difficulty**: Challenging · **Track**: Virality
**Pitch**: Collective map of small daily exploitations — patterns, not individual call-outs.
**Why challenging**: Pins + category tags + threshold-based pattern detection. No named parties, low legal surface.
**User story**: As an auto commuter who just got charged ₹200 for a ₹90 ride, I pin the spot, pick 'transport overcharge', type the loss — and see the intersection already glowing red with 47 similar reports this month, which makes me feel weirdly seen instead of just angry.
**What you'll need**:
- Mapbox cluster layer — intensity only surfaces after N reports in a radius
- Convex — category-tagged incidents with spatial clustering query
- Claude — extracts category and rough loss from free-text descriptions
- Threshold logic — no single pin ever shows, only patterns at 5+ reports
- shadcn radio-group — pre-set categories keep submissions fast and clean

**Demo moment**: Filter the map to 'housing scams' and watch three specific building clusters light up — the presenter zooms in and the audience recognizes the brokerage area everyone warns newcomers about.

### 48. Where Your Money Actually Goes

**Difficulty**: Challenging · **Track**: Virality
**Pitch**: Anonymous hyperlocal spend map. See what people like you actually spend here.
**Why challenging**: Range inputs + cohort filters + Convex aggregation. No exact numbers, no identity risk.
**User story**: As a 28-year-old renter in Indiranagar, I spend 12 seconds picking rent and food brackets, and the map tells me people my age here spend 22% more on eating out than me — I screenshot it, send it to my group chat, and three friends fill it out within an hour.
**What you'll need**:
- Mapbox choropleth — average spend per locality, cohort-filterable
- Convex aggregations — bucketed ranges rolled up by area + age + income band
- Claude — generates the one-line comparative insight ("you spend 22% more on food")
- Range-slider inputs — never exact rupee amounts, preserves anonymity
- Cohort filter chips — age band, income bracket, family status

**Demo moment**: Toggle the cohort filter to 'single, 25-30, mid-income' and the entire map re-colors live — one neighborhood flips from cheap to shockingly expensive, and the audience audibly reacts.

### 49. Landlord Reputation Map

**Difficulty**: Challenging · **Track**: Virality
**Pitch**: Anonymous building-level truth on deposits, issues, rent hikes. Never names individuals.
**Why challenging**: Building-keyed aggregation + quick-tag issues. Only patterns surface, never single reports.
**User story**: As a tenant about to sign a lease in Koramangala, I tap the building on the map and see '72% deposit return rate across 14 reports, common issue: random rent hikes' — I negotiate an addendum the next day and the landlord doesn't push back.
**What you'll need**:
- Mapbox building polygons — tap any building to see aggregated renter experience
- Convex — per-building rollups, minimum 3 reports before anything shows publicly
- Quick-tag issues — maintenance, water, rent hike, deposit, broker — no free-text required
- Claude — summarizes tag patterns into a human paragraph per building
- No-account 20-second submission — rent range, deposit range, return status, tags

**Demo moment**: Tap a well-known apartment tower in the demo city and watch the aggregate card load — '8-10 month deposits typical, 41% full return rate, frequent maintenance delays' — someone in the audience immediately says 'yeah, I lived there.'

### 52. The Bio Generator for Creators

**Difficulty**: Challenging · **Track**: Virality
**Pitch**: Paste three tweets. Get a sticky Twitter bio in your exact voice.
**Why challenging**: Input is three tweets, output is five bios. The whole surface is one textarea and a copy button.
**User story**: As Riya, a 19-year-old content creator in Mumbai with 8k followers, I paste my three favourite tweets and the tool gives me 'building in public from a hostel bed — ex-NIFT, currently unemployable.' I swap out my bio immediately, gain 200 followers in two days, and tweet the tool link. 4,000 people try it in 48 hours.
**What you'll need**:
- Claude — studies tone from three tweets and writes five bios
- Convex — stores every generated bio for the trending wall
- shadcn — single textarea, five-card output grid
- PostHog — tracks which bio style gets copied most
- Vercel — ships with a clean OG preview

**Demo moment**: Presenter pastes three of the host's real tweets live. The first bio is 'professionally unserious, seriously employed' and the host immediately changes his bio on stage.

### 54. Couple Compatibility for Co-Founders

**Difficulty**: Challenging · **Track**: Virality
**Pitch**: Two founders answer ten questions each. Get a brutal compatibility score.
**Why challenging**: Two-person async quiz, one joint result page, one share card. Zero backend complexity beyond a join code.
**User story**: As Megha and her co-founder Varun in Pune, we each answer ten questions separately — 'who handles the investor that ghosts us?' — and the result says 'Compatibility 62%. You disagree on hiring speed and you both hate sales. Fix this by month 4.' We screenshot it and post to Twitter. Three cofounder pairs DM us asking for the link.
**What you'll need**:
- Convex — pairs two sessions via a shared join code
- Claude — generates questions and writes the compatibility report
- shadcn — clean two-step async UI
- satori — renders the verdict card with both names
- Vercel — deploys with OG previews per pair

**Demo moment**: Two audience members pair up on stage, answer live, and the report reads 'you will fight about the pricing page in week 6.' Both nod.

## Beast Mode

### 34. AI Dungeon Master

**Difficulty**: Beast Mode · **Track**: Virality
**Pitch**: Text RPG with mechanical game state, dice-based combat, NPC memory graphs, and consequence propagation.
**Why beast**: Game state engine with hard constraints the LLM can't override, combat system (dice + stats), NPC relationship graph with reputation propagation, world persistence.
**User story**: As a player, I start a new campaign. The DM sets a scene. I say "I insult the blacksmith". The reputation graph updates: blacksmith hates me, his cousin the innkeeper now charges me double. In combat, I roll 2d20, my sword does 6 damage, the goblin has 4 HP, I crit. Everything the DM says is bound by the state, not vibes.
**What you'll need**:
- Game state engine (pure JS or Rust) with hard constraints
- Dice + stats combat system the LLM cannot override
- NPC relationship graph with reputation propagation
- LLM for narration only, tool-calling for any world mutation
- Persistent world save via SQLite or Convex
- Inventory + quest log as typed data structures

**Demo moment**: Play live for 90 seconds. Kill a goblin with a dice roll the audience sees. Insult a shopkeeper — the inventory prices update in real time. The audience realizes the DM can't cheat.

---

# 💰 Revenue ideas

## Starter

### 06. AI Product Photographer

**Difficulty**: Starter · **Track**: Revenue
**Pitch**: Upload a raw product photo, get professional variations.
**Why starter**: Background removal (rembg) + image generation API. Two-step pipeline with clear output.
**User story**: As an indie D2C founder with a phone photo of a candle on my desk, I upload it and pick a vibe: "marble, studio, Amazon-ready, lifestyle Instagram". Forty seconds later I have six professional shots: clean white background, marble surface with soft shadow, cozy bedside scene. I download all six.
**What you'll need**:
- rembg or Replicate background-removal model
- Stable Diffusion / Flux / Gemini for scene generation
- Vibe presets (studio, lifestyle, marble, outdoor)
- Drag-and-drop upload with preview
- Zip download of all variations

**Demo moment**: Take a photo of a water bottle on the demo table using your phone, upload, and in under a minute there are six e-commerce-ready shots on screen. The marketers in the room start typing Shopify URLs into their browsers.

### 55. CA Firm GST Notice Explainer

**Difficulty**: Starter · **Track**: Revenue
**Pitch**: Paste a GST notice. Get a plain-Hindi-or-English reply draft. ₹199 per notice.
**Why starter**: One PDF/text in, one structured reply out. Payment gates the download. No accounts for v1.
**User story**: As Suresh, a CA running a five-person firm in Indore, I get 14 GST notices a week from small-business clients. I paste one in, pay ₹199 via UPI, and get a structured reply referencing the exact sections. My junior would have taken 40 minutes — the tool takes 90 seconds. I process 20 notices in an evening.
**What you'll need**:
- Claude — parses the notice and drafts the reply with citations
- Razorpay — ₹199 UPI payment before download
- Convex — stores notices and replies for the firm dashboard
- pdf-parse — extracts notice text
- Vercel — deploys the paywalled download flow

**Demo moment**: Presenter pastes a real (redacted) GST notice. Payment modal pops, UPI clears in 4 seconds, reply appears with Section 73 citation. CAs in the audience audibly gasp.

### 56. Salon No-Show Recovery

**Difficulty**: Starter · **Track**: Revenue
**Pitch**: Upload missed-appointment list. Tool sends WhatsApp win-back offers. ₹999/mo.
**Why starter**: One CSV upload, one templated flow, one Razorpay subscription. Salon owners already have the data.
**User story**: As Priya, who runs two salons in Bandra, I lose ₹40,000 a month to no-shows. I upload last week's missed appointments, the tool sends a personalised 'we missed you — 20% off this Friday' on WhatsApp. Eight of 23 rebook. I pay ₹999/month without thinking.
**What you'll need**:
- Convex — stores appointments, tracks rebooking conversion
- Claude — writes the personalised WhatsApp copy per client
- AiSensy or Gupshup API — sends the WhatsApp message
- Razorpay — ₹999/mo subscription with auto-debit
- shadcn — clean CSV uploader and results dashboard

**Demo moment**: Presenter uploads a demo CSV of 23 no-shows. Three sample WhatsApps render on screen with real names. 'She would pay for this before the demo ends.'

### 58. Podcast Show Notes in 90 Seconds

**Difficulty**: Starter · **Track**: Revenue
**Pitch**: Drop an MP3. Get timestamps, pull-quotes, LinkedIn post. ₹299/episode.
**Why starter**: One file upload, one Claude call over the transcript, four outputs. Every podcaster already does this manually.
**User story**: As Neha, who produces a 3-hour founder podcast out of Bengaluru, post-production takes my editor 5 hours per episode. I upload the MP3, pay ₹299, and get timestamps, 8 pull-quotes, a LinkedIn post, and a YouTube chapter list. My editor's job becomes 45 minutes. I run 40 episodes through it in the first week.
**What you'll need**:
- Whisper via Replicate — transcribes the MP3
- Claude — extracts timestamps, quotes, LinkedIn post
- Razorpay — ₹299 per episode, ₹2,499 for 10 credits
- Convex — stores transcripts and outputs per user
- Vercel — deploys the upload-and-download flow

**Demo moment**: Presenter drops a 45-min episode MP3. 80 seconds later, the pull-quotes render on screen and one of them is genuinely tweetable. Audience starts taking photos of the screen.

## Challenging

### 12. The Accessibility Gauntlet

**Difficulty**: Challenging · **Track**: Revenue
**Pitch**: Experience broken accessibility through impairment simulations on your own site.
**Why challenging**: DOM manipulation for multiple impairment modes, WCAG violation mapping via axe-core, remediation engine.
**User story**: As a designer who just shipped a site, I paste the URL and pick "navigate with one hand, low vision, keyboard only". The site loads in an iframe with simulated impairments applied. I try to book a flight. I get stuck at a missing focus outline. A sidebar tells me exactly which component and how to fix it.
**What you'll need**:
- iframe proxy or Chrome extension for site injection
- axe-core for WCAG violation mapping
- Impairment simulators: keyboard-only, low-vision blur, motion sensitivity
- Screen reader emulator (NVDA output simulation)
- Fix-suggestion engine with code snippets per violation

**Demo moment**: Paste a famous e-commerce site. Attempt to check out keyboard-only. The cursor gets lost on a modal with no focus trap. The panel shows the exact fix. The room groans because it's their site too.

### 13. Bureaucracy Navigator (India)

**Difficulty**: Challenging · **Track**: Revenue
**Pitch**: Step-by-step process graphs for any government procedure, live-scraped.
**Why challenging**: Government site scraping (unreliable, heterogeneous), PDF parsing, process graph extraction, dependency mapping between steps.
**User story**: As a person who wants to register a company, I type "Private Limited registration in Maharashtra" and get a visual graph: DSC → DIN → Name reservation → MOA/AOA filing → PAN/TAN. Each node shows cost (₹), time estimate, and the exact form PDF. Pre-requisites are enforced with red arrows.
**What you'll need**:
- Scraper for mca.gov.in, incometax.gov.in, state portals
- PDF parser (pdfplumber, Unstructured) for form requirements
- LLM to extract step dependencies from procedure text
- Directed-graph visualizer (react-flow, D3)
- Cost + time aggregator per path

**Demo moment**: Type "FSSAI license for a home bakery". The process graph appears in 8 seconds with 11 nodes, total cost ₹7,500, total time 21 days. A CA in the audience pulls out their phone to double-check.

### 14. Neighborhood Safety Map (India)

**Difficulty**: Challenging · **Track**: Revenue
**Pitch**: Time-of-day safety heatmap for any neighborhood from multiple data sources.
**Why challenging**: Multi-source aggregation (Maps, news, Reddit, crowd data), geospatial visualization, time-slider UI.
**User story**: As a woman moving to a new city, I type "Koramangala, Bangalore". A map heatmap loads. I drag a time slider from 6am to 11pm. 6pm: mostly green. 9pm: yellow around the 5th Block bylanes. 11pm: red pockets near two specific crossings. Tooltips cite Reddit posts, news articles, and crowd density.
**What you'll need**:
- Google Maps JS API for the base map
- Reddit + local news scraper for incident mentions
- Crowd density from Google Places busy-hours data
- Geospatial heatmap layer with time-slider state
- LLM to classify incident severity from news snippets

**Demo moment**: Slide from 6pm to midnight in Bandra. The map shifts from soft green to sharp red in exact pockets. Click a red dot: three cited news articles appear. The women in the audience lean forward.

### 15. Scholarship & Grant Finder (India)

**Difficulty**: Challenging · **Track**: Revenue
**Pitch**: Profile-matched scholarship discovery from obscure government and corporate sources.
**Why challenging**: Multi-source scraping of scholarship databases, eligibility criteria extraction from unstructured text, profile matching engine.
**User story**: As a first-gen college student, I fill in a form: state, caste, family income, stream, marks. The app matches me to 23 scholarships I didn't know existed, including a ₹50k grant from an obscure state trust and a tech-specific one from an Indian corporate. Each row shows deadline, amount, and the exact application link.
**What you'll need**:
- Scraper across scholarships.gov.in, Buddy4Study, corporate CSR portals
- LLM to parse unstructured eligibility into structured criteria
- Profile → criteria matching engine with explainable "why" per match
- Deadline tracker with email reminders
- Regularly-refreshed database (Postgres + cron scrape)

**Demo moment**: Fill in a sample student profile. 23 matched scholarships appear, totaling over ₹3 lakh. Click one: the app opens the exact filing link with eligibility pre-checked. The room gets quiet.

### 18. Micro-SaaS Idea Validator

**Difficulty**: Challenging · **Track**: Revenue
**Pitch**: One-sentence idea in, full competitive landscape + gap analysis out.
**Why challenging**: Live competitor scraping (G2, Capterra, Reddit), pricing analysis, keyword volume lookup, gap synthesis.
**User story**: As an indie hacker with an itch, I type "CRM for Indian freelancers" and get a report: 7 existing tools (with pricing, reviews, MRR estimates where known), top 5 Reddit complaints about them ("no GST invoicing", "clunky on mobile"), and a scored list of 4 underserved gaps I could own in 90 days.
**What you'll need**:
- G2/Capterra scraper for competitor profiles + pricing
- Reddit + Twitter search for unfiltered user complaints
- Keyword tool API (Ahrefs/SERP scraping) for search volume
- LLM gap-synthesis with scored opportunity list
- Exportable PDF validation report

**Demo moment**: Type a live idea from the audience. The validator returns 7 competitors, 5 recurring complaints, 4 positioning gaps, all cited. A founder in row 2 is already drafting a landing page.

### 19. Apartment Hunt Companion (India)

**Difficulty**: Challenging · **Track**: Revenue
**Pitch**: Paste a listing URL, get price fairness analysis, commute, and landlord questions.
**Why challenging**: Multi-site scraping for comparables, Maps API for commute, review scraping, question generation.
**User story**: As a renter about to meet a broker, I paste a NoBroker link. The app fetches 14 comparable listings in 500m radius (avg ₹32k vs this ₹38k — 18% above market), maps commute to my office (28 min, 7 minute walk to metro), scrapes landlord reviews, and gives me 12 specific questions to ask at the viewing.
**What you'll need**:
- Scraper for NoBroker, MagicBricks, 99acres, Housing
- Google Maps Distance Matrix for commute time
- Listing-history scrape for price-drop detection
- Landlord/society review scraper (Google Maps reviews + forums)
- LLM question-generator tailored to listing gaps

**Demo moment**: Paste a real listing URL. 14 comparables appear, commute draws itself on the map, a 12-question viewing checklist prints. The renters in the audience are screenshotting.

### 20. Warranty & Subscription Tracker

**Difficulty**: Challenging · **Track**: Revenue
**Pitch**: Forward emails or upload receipts, get a dashboard of expiring warranties and auto-renewing subscriptions.
**Why challenging**: Email/receipt parsing (heterogeneous formats), date extraction, reminder scheduling, dashboard UI.
**User story**: As a household that buys too much stuff, I forward receipts to a dedicated email. The app parses them: MacBook warranty expires Mar 2027, Netflix auto-renews next Tuesday at ₹649, a refrigerator extended warranty expires in 17 days. I get a push notification the morning before anything auto-renews.
**What you'll need**:
- Forwarding email address with webhook (Postmark, Mailgun)
- Receipt parser (LLM + OCR fallback) for varied formats
- Date extraction for warranty expiry + renewal cadence
- Scheduled reminders (cron + SMTP or push)
- Dashboard with expiring-soon list and total spend chart

**Demo moment**: Forward three real receipts live. The dashboard populates with warranty dates, next-renewal amounts, and one big banner: "Disney+ renews tomorrow, ₹1,499. Cancel?" The audience sees it's worth ₹4 lakh across their own lives.

### 21. The Ghost Kitchen Finder

**Difficulty**: Challenging · **Track**: Revenue
**Pitch**: Trending food content matched to local restaurants that already serve it.
**Why challenging**: Social media trend detection (volume spike analysis), cross-referencing with restaurant menus, geolocation matching.
**User story**: As someone scrolling through Instagram seeing "viral Dubai chocolate" a hundred times, I open the app. It's tracking 32 trending food items this week in my city. It tells me three restaurants within 4km already serve Dubai chocolate (with price, rating, and photo), plus how long each has been serving it — so I know who jumped on the trend first.
**What you'll need**:
- Instagram/TikTok trend crawler for food hashtags + volume spikes
- Zomato/Swiggy menu scraper
- Geolocation matching + distance ranking
- LLM for fuzzy dish-name matching ("Dubai chocolate" vs "Kunafa bar")
- Menu-add-date tracker for authenticity signal

**Demo moment**: Pick a city from the demo laptop. The feed shows this week's top 5 trending dishes, each with 3 nearby restaurants serving them. Click one: a map zooms in. The audience immediately wants the app.

### 22. Indian Tax Return Companion

**Difficulty**: Challenging · **Track**: Revenue
**Pitch**: Step-by-step ITR filing guide that knows which form you need and catches mistakes.
**Why challenging**: Tax form logic (ITR-1 vs 2 vs 3 vs 4 decision tree), field-level guidance, mistake detection against known error patterns.
**User story**: As a salaried person with some freelance income and mutual fund sales, I answer six simple questions. The app tells me "you need ITR-2, not ITR-1" and walks me through each section. When I enter ₹0 under capital gains, it flags: "you sold Zerodha funds this year — did you include the SIP exits?"
**What you'll need**:
- Decision tree for ITR-1 vs 2 vs 3 vs 4 based on income types
- Section-by-section guided form with plain-English explanations
- Known-mistake-pattern library (missing 80C, wrong 26AS cross-check)
- CAS/26AS PDF parser (pdfplumber) for capital gains detection
- Pre-filled export in IT-portal-compatible XML

**Demo moment**: Fill in a sample salaried + SIP + freelance profile. The app auto-selects ITR-2, flags three common mistakes, and exports a ready-to-upload XML. A CA in the audience runs their own numbers.

### 25. Gym Bro Form Checker

**Difficulty**: Challenging · **Track**: Revenue
**Pitch**: Upload exercise video, get frame-by-frame form analysis with timestamps.
**Why challenging**: Pose estimation (MediaPipe), joint angle calculation, exercise-specific form rules, timestamp annotation on video.
**User story**: As someone who squats at home, I upload a 20-second side-view video. The app detects it's a back squat, analyzes 17 reps, and tells me: "rep 3: knees caved at 0:04, rep 7: hips rose first at 0:12, rep 14: depth above parallel." Each note is clickable and jumps to that timestamp with pose overlay.
**What you'll need**:
- MediaPipe Pose or BlazePose for skeletal keypoints
- Exercise classifier (squat/deadlift/bench) from keypoint pattern
- Rule engine per exercise (knee tracking, hip-to-shoulder angle, depth)
- Video annotator with timestamp jump + pose skeleton overlay
- Summary report: good reps, bad reps, top 3 fixes

**Demo moment**: Upload a squat video from a builder's phone. Skeleton overlays appear, rep 7 gets flagged, clicking it jumps to the exact moment. The lifters in the audience suddenly want it on their watch.

### 57. Real Estate Broker Listing Poster

**Difficulty**: Challenging · **Track**: Revenue
**Pitch**: One form in. 11 platform-perfect listings out — 99acres, MagicBricks, WhatsApp, Insta. ₹499/listing.
**Why challenging**: One input, many formatted outputs. No scraping, no accounts — just copy-paste formatting the broker already does by hand.
**User story**: As Rakesh, a broker in Andheri East, I post the same 2BHK on seven platforms every day. I enter the flat details once, pay ₹499, and get seven perfectly-formatted listings plus an Instagram carousel and a WhatsApp broadcast text. What used to take 90 minutes takes 4. I buy 15 credits a week.
**What you'll need**:
- Claude — rewrites the listing for each platform style
- satori — generates the Instagram carousel PNGs
- Razorpay — ₹499 per listing, or ₹3,999 for 15 credits
- Convex — stores listings and credit balance per broker
- Vercel — deploys the one-form interface

**Demo moment**: Presenter enters a real Bandra 2BHK. 99acres copy, MagicBricks copy, and the Insta carousel render in 6 seconds. Brokers in the audience ask for the link before the demo ends.

### 59. D2C Return Reason Analyzer

**Difficulty**: Challenging · **Track**: Revenue
**Pitch**: Upload Shopify returns CSV. Get a ranked list of what is actually broken. ₹1,499 one-time.
**Why challenging**: One CSV in, one dashboard out. Every D2C founder has the data, nobody has the time to read 400 free-text return reasons.
**User story**: As Aarav, who runs a skincare D2C brand in Delhi doing ₹80L/month, I have 312 returns last quarter and no idea why. I upload the CSV, pay ₹1,499, and get 'Top reason: packaging leaked in transit — 41% of returns on the 200ml serum.' I switch couriers the same week and returns drop 22%.
**What you'll need**:
- Claude — clusters free-text return reasons into themes
- Convex — stores uploads and ranked themes per brand
- Razorpay — ₹1,499 one-time, or ₹4,999 quarterly
- shadcn + Recharts — clean ranked dashboard with SKU drill-down
- Vercel — deploys the gated upload flow

**Demo moment**: Presenter uploads a sample Shopify returns CSV. Dashboard renders: '41% of your returns are one SKU with leaking caps.' Two D2C founders in the front row pull out their phones.

## Beast Mode

### 32. The Hiring Proof

**Difficulty**: Beast Mode · **Track**: Revenue
**Pitch**: Live assessment environment with generated codebases, behavioral telemetry, and portable build profiles.
**Why beast**: Codebase generation with calibrated difficulty, IDE-level telemetry, test runner integration, behavioral analysis, profile engine.
**User story**: As a candidate tired of Leetcode, I open the app. It spins up a real 4,000-file codebase with a calibrated bug in it. I debug for 60 minutes in-browser. The env watches my keystrokes, how I read code, which files I open, when I run tests. Result: a portable profile I can share with hiring managers showing HOW I work, not just if I solved it.
**What you'll need**:
- Codebase generator with calibrated difficulty tiers
- Browser IDE (Monaco + WebContainers or StackBlitz SDK)
- Keystroke + file-open + test-run telemetry capture
- Behavioral analysis model (debug style, exploration vs guessing)
- Portable build profile (shareable URL + PDF)
- Fraud detection for copy-paste from external LLMs

**Demo moment**: A judge debugs a generated bug for 3 minutes live. The dashboard shows which files they read, in what order, when they ran tests. The profile exports as a shareable link. Every hiring manager in the room asks for beta access.

### 33. The Git Time Machine

**Difficulty**: Beast Mode · **Track**: Revenue
**Pitch**: Semantic dependency graphs between commits, counterfactual history exploration, entanglement detection.
**Why beast**: Function-level dependency extraction from diffs (multi-language AST parsing), counterfactual engine with automated correctness verification, graph visualization.
**User story**: As a senior engineer staring at a 4-year-old repo, I ask: "what happens if we revert commit abc123?" The app shows the semantic dependency graph: that commit touched fn `calculateTax`, which 11 later commits depend on. It runs a counterfactual replay with the revert applied and shows exactly which tests break and which features disappear.
**What you'll need**:
- Multi-language AST parser (tree-sitter) for function-level diffs
- Semantic dependency graph built across commit history
- Counterfactual replay engine (shadow git worktree)
- Automated test runner verifying counterfactual correctness
- Graph visualization (D3 force layout or Cytoscape)
- Entanglement detector for high-risk coupled commits

**Demo moment**: Open a real open-source repo on stage. Pick a random old commit, click "what if we revert this". The graph redraws, 11 dependent commits light up, 3 tests go red. The senior engineers in the room whisper "oh."

---

# 🤖 MaaS ideas

## Challenging

### 26. Daily Podcast Builder

**Difficulty**: Challenging · **Track**: MaaS
**Pitch**: Connected sources auto-generate a narrated podcast episode every morning.
**Why challenging**: Multi-source aggregation, script generation, TTS narration, audio mixing, RSS feed generation.
**User story**: As a founder who never reads my saved articles, I connect 5 sources: my Readwise, HN favorites, two newsletters, a crypto Substack. Every morning at 7am a 12-minute podcast lands in my Overcast with an intro jingle, a host voice reading a synthesized digest, and ad-style transitions between topics.
**What you'll need**:
- Source connectors: RSS, Readwise API, Substack, HN, Pocket
- LLM script-generation with host + co-host style
- ElevenLabs or OpenAI TTS with two distinct voices
- ffmpeg for intro jingle + segment transitions + ducking
- RSS feed generator compatible with Overcast/Apple Podcasts

**Demo moment**: Play today's auto-generated episode on stage for 40 seconds. Two voices banter over real news items, a jingle plays between segments. The podcasters in the audience look at each other.

### 27. Neighborhood Oracle

**Difficulty**: Challenging · **Track**: MaaS
**Pitch**: Enter any neighborhood, get the actual vibe from Reddit, Instagram, Maps, and real estate data.
**Why challenging**: Multi-source aggregation with sentiment synthesis, geo-tagged post analysis, trend detection.
**User story**: As someone deciding between HSR and Indiranagar, I type both. Each one returns a vibe card: "HSR: young techies, brunch, 68% satisfaction, complaint theme = traffic post-6pm, rising rents" vs "Indiranagar: older money, queer-friendly, 74% satisfaction, complaint theme = parking, stable rents." Cited sources under each line.
**What you'll need**:
- Reddit geo-search + r/bangalore scraper
- Instagram geo-tagged post analyzer
- Google Maps review aggregation
- 99acres/MagicBricks rent-trend scraper
- LLM sentiment + theme synthesis with citations

**Demo moment**: Type "HSR Bangalore" and "Bandra Mumbai" side by side. Both vibe cards render with stats, top complaints, and three cited Reddit threads. The room sees their own city in the data.

### 28. Chrome Extension: Who Made This Website

**Difficulty**: Challenging · **Track**: MaaS
**Pitch**: Click on any site, see the team, stack, funding, and developers behind it.
**Why challenging**: Tech detection + company lookup + team identification from multiple APIs, browser extension architecture.
**User story**: As a dev on any website, I click the extension. A side panel slides in: "Linear.app — stack: Next.js, tRPC, PostgreSQL, Vercel. Company: Linear Inc, Series B, $35M, 62 employees. Founders: Karri Saarinen, Tuomas Artman. Current team with LinkedIn + GitHub links. Built with Claude Code? Probably not."
**What you'll need**:
- Chrome MV3 extension with content script + side panel
- Wappalyzer-style tech detection
- Crunchbase/LinkedIn/BuiltWith enrichment APIs
- Team identification by scraping careers/about pages + LinkedIn
- GitHub lookup to cross-reference named employees

**Demo moment**: Install extension live, visit linear.app, click icon. Side panel populates in 3 seconds with founders, funding, team, and stack. Every founder in the room installs it while the demo is still running.

### 35. AI Marketing Team

**Difficulty**: Challenging · **Track**: MaaS
**Pitch**: Brand brief in, full campaign out: landing copy, 2-week social calendar, email sequence, launch thread.
**Why challenging**: CMO + copywriter + social planner + editor agents. Brand-voice consistency across artifacts, channel-calibrated output per platform.
**User story**: As a solo founder launching a dev tool, I paste a brand brief: "CLI for X, irreverent voice, sarcastic like Oatly." Four agents go to work. The CMO writes the strategy. The copywriter drafts landing copy. The social planner builds a 14-day calendar. The editor rewrites everything in the shared voice. 90 seconds later I have a launch packet.
**What you'll need**:
- LangGraph or custom orchestration with 4 agent roles
- CMO agent owns strategy + brand bible generation
- Copywriter + social planner + editor agents as workers
- Shared brand-voice state passed between agents
- Channel-specific formatters (Twitter, LinkedIn, email HTML)
- Anthropic or OpenAI as the LLM layer with per-role system prompts

**Demo moment**: Paste a one-line brief on stage. Four agent panels stream in parallel. The editor flags a tonal mismatch in the copywriter's draft and sends it back. Final packet assembles in 90 seconds. The marketers in the room go pale.

### 36. AI HR Team

**Difficulty**: Challenging · **Track**: MaaS
**Pitch**: JD in, sourced candidates + personalized outreach + screening questions + interview panel out.
**Why challenging**: Head of Talent + sourcer + screener + outreach writer + scheduler agents. JD→ICP mapping, LinkedIn/GitHub scraping, tone-matched cold email per candidate.
**User story**: As a hiring manager, I paste a senior frontend engineer JD. Five agents collaborate: Head of Talent builds an ICP, sourcer scrapes 80 candidates from LinkedIn + GitHub, screener ranks them by fit, outreach writer crafts a personalized email citing each candidate's recent repo, scheduler inserts calendly slots. I approve a batch and it sends.
**What you'll need**:
- Orchestration layer: LangGraph or CrewAI for 5 roles
- LinkedIn + GitHub scrapers for candidate sourcing
- JD → ICP mapper + rank-by-fit scorer agent
- Per-candidate outreach writer with context window of their recent work
- Calendly/Cal.com integration for scheduling
- Human-in-the-loop approval UI before anything sends

**Demo moment**: Paste a real JD. Agent panel shows the sourcer surfacing 80 candidates, screener narrowing to 12, outreach writer drafting a different email per candidate. Pick one — it quotes their last PR. A recruiter watches and doesn't blink.

### 37. AI Content Team

**Difficulty**: Challenging · **Track**: MaaS
**Pitch**: Topic in, full package out: blog post + Twitter thread + LinkedIn post + newsletter + cover-image brief.
**Why challenging**: Editor-in-chief + researcher + writer + SEO specialist + social repurposer agents. Same POV across formats, per-channel calibration, style guide adherence.
**User story**: As a creator, I type a topic: "why junior devs should ship ugly code." Editor-in-chief sets the thesis. Researcher gathers supporting data. Writer drafts a 1,200-word post. SEO specialist tunes keywords. Social repurposer spins it into an 8-tweet thread, a LinkedIn post, and a newsletter blurb — all holding the same POV, each calibrated to its platform.
**What you'll need**:
- LangGraph orchestration with 5 roles + shared thesis state
- Editor-in-chief agent owns the POV
- Researcher with web search + citation tracking
- SEO agent using DataForSEO or Ahrefs API
- Social repurposer with platform-specific format constraints
- Diff view so the human editor can approve inline before publish

**Demo moment**: Type a topic. Five agent panels stream. Social repurposer tries to soften the thesis for LinkedIn — editor-in-chief rejects it and enforces the original POV. Five final artifacts print side-by-side.

### 38. AI Support Team

**Difficulty**: Challenging · **Track**: MaaS
**Pitch**: Inbox of tickets in, triaged + resolved + escalated + weekly post-mortem out.
**Why challenging**: Head of Support + triage + tier-1 + tier-2 + post-mortem writer agents. KB retrieval, escalation confidence scoring, incident pattern detection across tickets.
**User story**: As a solo SaaS founder drowning in Intercom, I connect my inbox and KB. The agent team wakes up: triage classifies 47 tickets, tier-1 auto-resolves 31 password resets, tier-2 handles 12 billing issues (escalates 2 I need to see), and at week's end the post-mortem agent writes: "23% of tickets were onboarding; ship a checklist."
**What you'll need**:
- Intercom/Zendesk API for ticket I/O
- Vector store for KB retrieval (pgvector or Pinecone)
- Triage agent with confidence-scored routing
- Tier-1 + tier-2 agents with escalation thresholds
- Post-mortem writer running on a weekly cron
- Human escalation queue with explicit uncertainty flags

**Demo moment**: Pipe 50 sample tickets in. The dashboard shows 68% auto-resolved in 30 seconds, 4 escalated with reasons, and a weekly report that says "onboarding is broken." The support leads in the audience quietly update their resumes.

## Beast Mode

### 29. AI Radio Station

**Difficulty**: Beast Mode · **Track**: MaaS
**Pitch**: 24/7 AI DJ monitoring live feeds with real-time commentary, music, and audience interaction.
**Why beast**: 5 coordinating agents (Feed Monitor, Editorial, DJ, Music, Listener), real-time audio generation, persistent personality, live state management across hours of broadcast.
**User story**: As a listener, I tune into the stream. An AI DJ with a consistent voice is mid-sentence about today's cricket score, segues into a song, takes a listener call-in from me on Discord, and spins it into the next segment. The station has been live for 6 hours with no repetition, reacting to news as it breaks.
**What you'll need**:
- 5 coordinating agents: Feed Monitor, Editorial, DJ, Music, Listener
- Real-time TTS with a persistent voice (ElevenLabs voice clone)
- Live news + sports + social feed ingestion
- Audio mixer that ducks music under DJ voice
- Listener call-in via Discord or Twilio with incoming routing
- Long-running persistent state (Redis + Durable Objects)

**Demo moment**: Stream the station live on the demo audio. A news event breaks on a live feed mid-show. The Editorial agent writes a segue, the DJ picks it up mid-sentence, announces it, and plays a themed song. The audience hears the agents visibly coordinate.

### 30. The Open Source Maintainer's Cabinet

**Difficulty**: Beast Mode · **Track**: MaaS
**Pitch**: Multi-agent system managing triage, PR review, releases, community, and docs for a repo.
**Why beast**: 5 agents with inter-agent conflicts (Triage wants to close, Community says "be gentle"), persistent project context, GitHub API integration across issues/PRs/releases.
**User story**: As a solo OSS maintainer, I connect my repo. 5 agents take over. Triage wants to close an old stale issue. Community objects: "the OP is a first-time contributor, respond gently first." They resolve to request an update with a kind message. PR agent drafts a review, Release agent notices the changelog is broken, Docs agent fixes an out-of-date example.
**What you'll need**:
- 5 roles: Triage, PR Review, Release, Community, Docs
- LangGraph with explicit inter-agent conflict resolution
- GitHub API (issues, PRs, releases, discussions)
- Persistent project context (repo vibe, contributor history)
- Voting or arbitration layer when agents disagree
- Human-in-the-loop approval for anything that writes to GitHub

**Demo moment**: Open a real repo with 80 open issues. Watch two agents argue on stage: Triage wants to close issue #234, Community pushes back citing the OP is a new contributor. They converge. A gentle reply drafts itself. The OSS maintainers in the room exhale.

### 31. The Codebase Civilization

**Difficulty**: Beast Mode · **Track**: MaaS
**Pitch**: Multi-agent system where Frontend, Backend, Security, and Performance agents collaboratively build from a spec.
**Why beast**: Inter-agent code review with semantic understanding, consensus mechanism, convergence problem (preventing infinite review cycles), each agent needs a real domain model.
**User story**: As a PM, I hand over a spec: "build a user-invite flow." Frontend drafts a React form. Backend drafts an API. Security reviews, flags the token is not signed. Performance reviews, flags the query is N+1. Frontend adjusts, Backend adjusts, Security approves, Performance signs off. The system knows when to stop reviewing and ship.
**What you'll need**:
- 4 agents: Frontend, Backend, Security, Performance
- Each agent has a real domain model (not just prompt)
- Inter-agent code review with semantic diff understanding
- Consensus mechanism + explicit convergence criteria
- Sandboxed code execution to verify before shipping
- Git branch/PR lifecycle as the output medium

**Demo moment**: Paste a feature spec live. Watch 4 agents debate in real time on screen. Security rejects the first version, Backend patches it, Performance complains about a query, all four sign off. A green PR appears. The engineers in the room go quiet.

### 39. AI Engineering Team

**Difficulty**: Beast Mode · **Track**: MaaS
**Pitch**: Feature request in, reviewed and tested PR out. Tech Lead routes to frontend + backend + QA + DevOps agents who review each other.
**Why beast**: The canonical agent-company build. Code generation across specialties, inter-agent code review, test runner integration, Git PR lifecycle, convergence problem (when does the review cycle end?).
**User story**: As a founder, I type "add a dark mode toggle." Tech Lead breaks it into tasks. Frontend drafts the toggle. Backend adds a user pref column. QA writes tests that catch a flash-of-unstyled-content bug. DevOps flags the migration needs a down script. Cycle repeats until all four approve. Final output: a green PR with passing CI.
**What you'll need**:
- Tech Lead + Frontend + Backend + QA + DevOps agents
- LangGraph orchestration with explicit review cycles
- Sandboxed code execution (Docker/Deno) per agent proposal
- Full Git PR lifecycle: branch, commit, PR, CI, review, merge
- Convergence rule: all agents must approve or max N cycles
- LLM API (Anthropic/OpenAI) with tool calling for filesystem ops

**Demo moment**: Paste a feature request. 5 agent panels stream side-by-side. QA rejects Frontend's first draft. Backend asks DevOps for a migration. Everyone approves. A real PR URL prints. The engineers in the room silently refresh GitHub.

### 40. AI Legal Team

**Difficulty**: Beast Mode · **Track**: MaaS
**Pitch**: Contract or legal situation in, risk analysis + redlines + filing drafts out.
**Why beast**: General Counsel + corporate + IP + compliance specialist agents. Document parsing, jurisdiction-aware reasoning, citation lookup, risk-rated output. Wrong output has real consequences — guardrails are part of the build.
**User story**: As a founder with a 40-page SaaS agreement, I upload it. General Counsel frames the risk profile. Corporate flags an auto-renewal clause. IP flags a "works made for hire" ambiguity. Compliance cross-references GDPR. I get a redlined PDF with 14 changes, each with a one-line rationale and a citation — and a loud banner: "this is not legal advice."
**What you'll need**:
- 4 agents: General Counsel, Corporate, IP, Compliance
- Document parser for PDFs + DOCX (Unstructured, Azure DI)
- Jurisdiction-aware reasoning + legal citation lookup
- Risk-rated redlining engine with explainable rationale
- Hard guardrails: "not legal advice" injected, uncertainty-first outputs
- Disagreement surfacing when agents rate the same clause differently

**Demo moment**: Upload a real SaaS agreement on stage. 4 agents flag different clauses. IP and Corporate disagree on a liability cap — both opinions appear side by side. A redlined PDF downloads with 14 changes. Lawyers in the room take notes.

### 41. AI Finance Team

**Difficulty**: Beast Mode · **Track**: MaaS
**Pitch**: Company books in, monthly close + cash flow forecast + tax prep + AR collections outreach out.
**Why beast**: CFO + bookkeeper + tax specialist + FP&A analyst + collections agents. Structured financial data, no-hallucination categorization, forecast modeling, outbound AR chase emails.
**User story**: As a startup founder on the last day of the month, I connect my bank + Stripe + QuickBooks. Bookkeeper categorizes 347 transactions with 0 hallucinations. FP&A produces a 13-week forecast. Tax specialist flags two deductions I missed. Collections agent drafts firm-but-kind chase emails to 4 late clients. CFO writes the board update.
**What you'll need**:
- 5 agents: CFO, bookkeeper, tax specialist, FP&A, collections
- Plaid + Stripe + QuickBooks integrations
- Deterministic rule-based categorizer with LLM fallback
- Forecast modeling (pandas + scenarios, not LLM math)
- AR outreach generator with tone ladder
- No-hallucination guardrail: every number must cite a ledger entry

**Demo moment**: Connect a sandbox Stripe account. Watch the bookkeeper categorize 347 transactions in 20 seconds, FP&A render a 13-week cash forecast chart, collections agent draft 4 chase emails. The CFO's board update reads like a human wrote it.

### 42. AI Sales Team

**Difficulty**: Beast Mode · **Track**: MaaS
**Pitch**: ICP in, prospect list + cold emails + demo script + proposal + onboarding plan out.
**Why beast**: VP Sales + SDR + AE + sales engineer + CSM agents. Live prospecting, multi-channel outreach generation, objection handling, pipeline state tracking across stages.
**User story**: As a founder with a new product, I paste an ICP: "Series A B2B SaaS, 50-200 employees, RevOps lead." VP Sales sets strategy. SDR scrapes 200 prospects. AE drafts personalized cold emails. Sales Engineer writes a demo script tailored to each company's stack. CSM drafts an onboarding plan for the 3 who say yes. Pipeline stage tracker shows everything in motion.
**What you'll need**:
- 5 agents: VP Sales, SDR, AE, Sales Engineer, CSM
- Apollo/LinkedIn-style prospecting API
- Multi-channel outreach (email, LinkedIn, warm intros)
- Per-prospect research with personalized opener generation
- Objection library + handling patterns
- Pipeline state machine across stages with handoff events

**Demo moment**: Paste an ICP. Watch the SDR find 200 prospects, AE draft 200 different cold emails (each citing the prospect's recent funding), pipeline populate in real time. One prospect replies mid-demo. The AE drafts a response. The room sees the handoff happen.

### 43. AI Product Team

**Difficulty**: Beast Mode · **Track**: MaaS
**Pitch**: User problem in, user stories + wireframes + acceptance criteria + analytics spec + ranked backlog out.
**Why beast**: Head of Product + PM + designer + data analyst + user researcher agents. User-journey modeling, wireframe generation, success-metric definition, cross-feature priority scoring.
**User story**: As a founder with a vague insight, I type "users keep dropping off at checkout." User researcher frames 3 hypotheses. Data analyst checks the funnel. Designer sketches 3 wireframe options. PM writes user stories with acceptance criteria. Head of Product ranks them by impact × effort. I get a prioritized backlog with analytics events already specified.
**What you'll need**:
- 5 agents: Head of Product, PM, designer, data analyst, researcher
- Wireframe generation via Excalidraw-style or SVG output
- Analytics spec generator (event names + properties)
- Priority scorer using ICE or RICE frameworks
- User journey modeler with drop-off-point analysis
- Output format: PRD markdown + wireframe images + event JSON

**Demo moment**: Type a real product problem. 5 agent panels stream. Designer drafts 3 wireframes, data analyst pulls mock funnel data, PM writes 7 user stories, Head of Product ranks them live. A ready PRD exports. The PMs in the room stare at each other.

### 44. Build Your Own AI Team

**Difficulty**: Beast Mode · **Track**: MaaS
**Pitch**: Describe any service business, spin up a custom agent org with configurable roles and escalation paths. Watch it run a live task.
**Why beast**: Meta-system. Role-definition DSL, inter-agent protocol setup, live observability, management UI. Effectively a platform, not a product.
**User story**: As a builder, I type "a boutique law firm specializing in startup contracts." The app generates an org chart: Managing Partner, Corporate Associate, IP Counsel, Paralegal, Intake. I edit roles, set escalation paths ("Paralegal → Corporate Associate if complexity > 6"), hit run. I throw a real task at it and watch the org execute in real time.
**What you'll need**:
- Role-definition DSL (YAML or JSON) for specifying agents
- Inter-agent protocol: messages, handoffs, escalation rules
- Live observability dashboard (per-agent state + message log)
- Management UI for editing org chart mid-run
- LLM layer with role-scoped tool access
- Replay + fork: branch the org from any historical moment

**Demo moment**: Type a business in natural language. The app builds an org chart in 10 seconds. Edit one escalation rule live. Send a task. Watch the message log stream between agents in real time — someone escalates, the Managing Partner resolves. The audience sees a platform, not a demo.
