# Clio: project plan

Clio is the muse of history. The name was chosen by the user on 2026-11-14.

**Last updated:** 2026-11-14 14:40 PST
**Phase:** built and deployed for the demo; pitch deck written. Adobe back in (user's call, 14:40): the user finishes the deck in Adobe Express with Firefly cover art. Remaining: that, registration and submission (user).
**Hard deadline:** submission at 3:00 PM PST today. Build window opens 11:00 AM.

This file is the single source of truth for what we are building and where we are.
Read it before starting any work, and update the **Status** section after every finished step.

---

## 1. The pitch

Stage a real historical battle as a living map. Every commander is an AI agent whose
personality is extracted from that commander's own documents, and every decision each
agent makes is made by Drex in milliseconds, with a visible probability for each option.
Left alone, the agents replay history. A person can step into any commander's boots, give
a different order, and watch history bend.

Pitched as "any battle"; demoed on one: **Gettysburg, Day 2 (July 2, 1863, about 4 PM to dusk)**,
southern end of the field.

## 2. Hackathon constraints

| Item | Value |
|---|---|
| Event | Drexathon (Nace AI x Adobe EDU), San Francisco, 2026-11-14 |
| Team | Solo |
| Track | Swarm Intelligence: multiple agents coordinate, compete or negotiate, Drex makes every agent's calls |
| Bonus | NDI used to bring real documents into the build |
| Extra prize | Best Use of Adobe (Firefly, Express, Photoshop) |
| Schedule | 11:00 build begins, 3:00 PM hard submission deadline, 3:15 finalist demos, 5-minute limit |
| Judging | Live on the main stage. At kickoff the judges said they want to see a **real use case solved with Nace** (reported by the user, 2026-11-14). |

### Official rules (from nace.ai/drexathon, read 2026-11-14 11:00)

1. Build with Intern, the Nace harness.
2. Extra credit for partner tools: Adobe, DeepInfra.
3. Finalize before the countdown reaches zero (about 3:00 PM). No edits after the deadline.
4. Every team: a presentation plus code in the open-source library at nace.ai/drexathon.
5. Pick one of the use-case tracks.
6. **Finalists are picked by usage of Drex, Intern, NDI, and partner tools.**

What this means for us:

- **Intern** is Nace's AI agent that lives in Slack (@Intern), with its own computer, browser and
  email; early access, reached by "DM @Intern in Slack" from nace.ai/intern. No public developer
  API was found. We currently have no role for it; see Q30.
- **DeepInfra** is a partner tool, so the dispatch-writing LLM runs there, not on Anthropic (settled, Q31).
- **Usage counts.** The swarm (about 28 Drex calls per turn, plus explainability re-asks and
  fidelity runs) and the NDI persona pipeline should all run on the user's own key so the usage is attributed.
- **Credits:** sign in to console.nace.ai with Google or GitHub, open Billing, redeem promo code
  `DREXATHON` for $35.
- **Submission:** nace.ai/drexathon/submit. Register a team with the event code from an organizer
  to get a private access key, save the project there, and finalize before the timer ends. The
  code must be open source, so secrets stay in a git-ignored `.env`.

## 3. Settled decisions

| # | Decision | Answer |
|---|---|---|
| Q1 | Track | Swarm Intelligence |
| Q2 | Scope | Pitched as any battle; one well-documented US battle is built |
| Q8 | Battle | Gettysburg, Day 2 only, about 4 PM to dusk |
| Q4/Q9 | Simulation shape | A map with units moving, limited freedom. Units directly under a commander take orders; units not directly controlled follow their own unit behaviour. Turns are 20 to 30 minutes of battle time. Code lists every legal order (hold, march to X, attack X, fall back, reinforce Y) and Drex picks one. Extra features wanted here to make it strong for judges (see section 4). |
| Q10 | Coordination | Two tiers at minimum: Lee and Meade set objectives; Longstreet, Hood, Sickles, Warren and Chamberlain receive the order in their `state` and Drex decides whether they obey, drag their feet or deviate, based on persona. Extra features wanted here too (see section 4). |
| Q11 | Combat resolution | Code, with a fixed seed. Drex decides; arithmetic stays in code so a run is repeatable and a changed outcome traces to a changed decision. |
| Q3/Q12 | Runtime LLM | Drex makes every decision. The user may type an order in plain English and Drex maps it to a legal move. A DeepInfra-hosted model writes a one-line in-character dispatch after Drex has decided (changed from the build Haiku by Q31); templates are the fallback. |
| Q5/Q13 | Players | One user on one laptop can take over any commander at any decision point. Multiplayer: the server holds the game state so a second browser tab can claim another commander. No accounts, no lobby. Built last, cut first, shown only as a recording. |
| Q6 | NDI | Real primary sources (reports, letters, memoir excerpts) go through NDI Extract to build each commander's persona profile; every trait cites a page. |
| Q7 | Stack | TypeScript end to end: Node server, React, animated SVG map. |
| Q7/Q14 | Visual bar | Incredibly beautiful and detailed, smooth animation, live action, nothing generic. Period campaign map, engraved type, blue and gray unit blocks marching along roads, dispatches as telegram cards, Drex probabilities as ink bars. The map is based on documented maps of the period, with our own finish. |
| Q14 | Adobe | The user generates commander portraits and a parchment map texture in Firefly during the build. |
| Q15 | Keys | Nace key and credits come later via the event QR code; DeepInfra key set up by the user (Q31). Keys go in `.env`, never in chat or git. |

Round 3, confirmed 2026-11-14 about 10:40:

| # | Decision | Answer |
|---|---|---|
| Q16 | Agent tiers | Three tiers, all decided by Drex, about 28 agents per turn: army (Lee, Meade) set objectives; corps and division commanders decide whether to comply and what to order; about 20 brigade agents each decide stand, fall back, rout or countercharge. Chamberlain's bayonet charge should emerge from this, not be scripted. |
| Q17 | Map and unit extras | Terrain per location (high ground, woods, rocks, open field), ammunition and fatigue per unit, and couriers: orders ride along the roads as animated riders and arrive late. No full fog of war. |
| Q18 | Coordination extras | Protest and appeal up the chain, where the superior decides (Hood to Longstreet to Lee). Reinforcement requests between peers, where each peer decides whether to release troops (Warren's call at Little Round Top). A council of war at dusk where Meade's generals vote. No trust scores. |
| Q19 | Explainability | Click any decision to see which persona traits moved it: re-ask Drex with each trait removed and show the probability shift. Each trait links to its NDI page citation. |
| Q20 | Measured result | A history fidelity score: on autopilot, how many of about 8 documented decisions the agents reproduce, with the NDI personas and without them. Plus an end-state comparison with history on the key ground. |
| Q21 | Demo script | As in section 8. |
| Q22 | Map source | The map is drawn as SVG with positions taken from a public-domain period survey, over the Firefly parchment texture. No raw scan as background. |
| Q23 | Decision ledger | Always visible in a corner: decisions made, median latency, total cost, and what the same run would cost on a frontier LLM. |
| Q24 | Name | Clio, the muse of history. The name should evoke history and stepping into the event; "Turning Point", "Countermand" and "Firsthand" were rejected. |
| Q25 | Start time | Coding starts at 11:00 AM. Until then, brainstorming and planning only. |

Confirmed 2026-11-14 about 11:20:

| # | Decision | Answer |
|---|---|---|
| Q31 | Dispatch-writing LLM | DeepInfra (partner tool), not Anthropic. Key in `DEEPINFRA_API_KEY`, model in `DEEPINFRA_MODEL` (default `Qwen/Qwen3.8-27B`, confirmed in DeepInfra's model list; $0.15 in, $1.875 out per 1M tokens). Its thinking mode is on by default, so turn it off per request for one-line dispatches. Whether the Q29 comparison also runs on DeepInfra is decided with Q29. |

## 4. Settled after the official rules, and still open

Settled 2026-11-14 about 11:15:

| # | Decision | Answer |
|---|---|---|
| Q27 | Real-use-case framing | Lead with the staff ride: military schools and leadership courses walk Gettysburg to study how commanders decided under pressure; it takes a trip, a historian and a day. Clio gives any classroom or training course that exercise, grounded in the commanders' own documents. |
| Q28 | After-action report | Yes: at dusk, a debrief of where the player departed from the historical commander and what followed, built from the decision log. |
| Q29 | Measured comparison | Yes: the same decisions put to Drex and to a general LLM, measured, shown in the ledger (`server/scripts/measure.ts`). In the cut list just above multiplayer. |
| Q30 | Intern | Used inside the product (user: "let's try to use intern and DeepInfra in the system"). Intern is the open-source harness at github.com/nace-ai/intern: System 1 is Drex, System 2 is a DeepInfra model. Clio runs it headless to write the after-action report from the run's decision log (`server/report.ts`). |
| Q31 | DeepInfra | Yes. A DeepInfra-hosted model (default `Qwen/Qwen3.8-27B`) writes the one-line dispatches and is Intern's System 2. Anthropic is not used. |

Resolved: **Intern did not start on Windows** (it imports the Unix-only `fcntl` module, and uses process groups and SIGHUP). This laptop has no WSL distribution and no Docker. A two-file shim in `tools/intern-windows-shim/` fixes it, and a headless Intern task now completes here. If Intern fails at report time, the same DeepInfra model writes the report directly and the report card says so.

Still open:

| # | Open question | State |
|---|---|---|
| Q32 | Presentation | Required by rule 4. Proposed: a five-slide deck the user builds in Adobe Express from the outline in `docs/pitch.md`. Not yet confirmed. |

Submission (from the organizers): register the team at nace.ai/drexathon/submit with code `Drexathon2026` (team name, member names, contact email), keep the private team link, then add title, explanation, track, presentation, GitHub repo link and an optional demo URL, push all code and click **Finalize**. Only finalized entries are judged.

## 5. How it works

### 5.1 Agents

| Tier | Who | Decides | Drex question |
|---|---|---|---|
| Army | Lee, Meade | Objectives for subordinates; whether to accept a protest | `choice` over objectives; `noul` on a protest |
| Corps and division | Longstreet, Hood, Sickles, Warren, Chamberlain (and others as needed) | Obey, delay, protest or deviate; then the concrete order | `choice` over compliance; `choice` over legal orders |
| Brigade | About 20 brigades | Stand, fall back, rout, countercharge | `choice`, driven by morale, losses, ammunition, leader persona |

Units not under a commander's direct order follow unit behaviour: they hold ground, react to
contact and break when morale fails.

### 5.2 Turn loop (one turn = 20 to 30 minutes of battle time)

1. Couriers already on the road advance; orders that arrive are placed in the receiver's `state`.
2. Army commanders decide objectives.
3. Subordinates decide compliance, then pick one legal order. If a human holds that commander, the human picks (by clicking, or by typing an order that Drex maps to a legal move).
4. Brigades decide their reaction.
5. Code resolves movement and combat with a seeded random source.
6. Dispatch lines are written (DeepInfra model or template) and the state is broadcast to every browser tab.
7. At dusk the battle ends; the end state is compared with history.

### 5.3 Drex request shape

One request per agent per turn. Persona, situation and standing orders go in `state`; the
decisions are typed questions. Independent questions about the same state share one request;
a decision that needs an earlier answer is a second request.

```json
{
  "model": "<pinned id from GET /v1/models>",
  "state": {
    "you": { "name": "Daniel Sickles", "role": "III Corps", "traits": ["..."] },
    "standing_order": { "from": "Meade", "text": "Hold the line on Cemetery Ridge..." },
    "situation": { "time": "16:00", "position": "Cemetery Ridge (south)", "units": ["..."], "enemy_seen": ["..."] }
  },
  "questions": {
    "compliance": {
      "type": "choice",
      "instructions": "How does this commander respond to the standing order?",
      "criteria": { "obey": "...", "delay": "...", "protest": "...", "deviate": "..." }
    }
  }
}
```

Rules taken from the Drex docs:

- Pin a model id from `GET /v1/models` and check the `model` field of every response.
- Up to 255 options per `choice`, 512 questions per request.
- Free tier: 120 requests per minute, 8 in flight. A turn of about 28 agents fits.
- Call only from the server; the `/v1` routes send no CORS header.
- Probabilities are shown, never hidden: they are the "pull of history".

### 5.4 NDI persona pipeline (run once, before the battle)

1. For each commander, one or two short primary-source excerpts (public https URL, page range).
2. `POST /v1/documents/extract` with a persona schema: temperament, risk appetite, attitude to orders, relationship to superior, signature decisions on July 2.
3. Every field comes back `found`, `not_found` or `ambiguous` with a page citation and quote.
4. Results are cached to `data/personas/*.json` so the demo never waits on a document job.

Constraint: on free balance a document is capped at 3 Extract pages (10 Parse pages) unless
auto-pay is on. Excerpts are chosen to fit. Source list: `docs/research/gettysburg-sources.md`.

Source notes that affect the build:

- The scanned Official Records PDFs are 60 to 105 MB and their page indices are estimates, so
  the first NDI run must confirm the printed page number. Clean HTML fallbacks exist for 9 of
  the 13 documents.
- Chamberlain has two different July 6, 1863 texts: the Official Records version and the
  handwritten Maine State Archives original (an 8-page scan, a good "messy file"). Use the
  handwritten one for the NDI showcase.
- Sickles, Hood and Warren left no official report for the day; their sources are later and
  self-justifying. The persona profile should say so.

### 5.5 Combat

Deterministic formula over strength, terrain, morale, fatigue and ammunition, plus one seeded
random factor. Same seed and same decisions give the same battle.

### 5.6 Mock mode

Until the Nace key exists, a mock decider returns plausible probabilities from persona weights
so the engine and UI can be built and demoed offline. Switching to live Drex is one environment
variable. The UI shows clearly which mode is running.

## 6. Architecture

```
server/   Node + TypeScript: game engine, turn loop, Drex client, NDI client, DeepInfra dispatches,
          WebSocket broadcast of game state
web/      React + Vite + TypeScript: SVG campaign map, unit animation, commander panels,
          probability bars, telegram cards, decision ledger
data/     map graph, order of battle, historical decisions, cached personas
docs/     plan.md (this file), research/, agents/
```

Environment variables (in `.env`, git-ignored): `NACE_API_KEY`, `DEEPINFRA_API_KEY`, `DEEPINFRA_MODEL`, `DECIDER=mock|drex`, `DREX_MODEL`, `PORT`.

## 7. Visual direction and Adobe assets

- Period campaign map: parchment, hachured ridges, engraved serif type, compass rose.
- Unit blocks in Union blue and Confederate gray that march along roads; clashes shown as smoke and line flashes.
- Couriers ride between headquarters as small animated riders.
- Dispatches arrive as telegram cards with a typed-on effect.
- Each commander has a panel: portrait, current order, and Drex's probabilities as ink bars.

Firefly assets the user generates:

| Asset | Count | Notes |
|---|---|---|
| Commander portraits | 7 | Lee, Longstreet, Hood, Meade, Sickles, Warren, Chamberlain; engraved or daguerreotype style, consistent framing |
| Parchment map texture | 1 | Large, seamless if possible |
| Title card | 1 | Optional, for the demo opening |

### Firefly prompts

Generate all seven portraits with the same prompt, style reference and aspect ratio (3:4) so
they read as one set. Swap only the bracketed description. Save as
`web/public/portraits/<surname>.png` (lowercase) and the texture as `web/public/parchment.jpg`.

Portrait template:

> Steel-engraved portrait in the style of an 1860s newspaper illustration, fine cross-hatching,
> sepia ink on aged cream paper, head and shoulders, three-quarter view, plain background,
> oval vignette, no text, no lettering. Subject: [description].

| File | Description to insert |
|---|---|
| `lee.png` | a dignified Confederate general in his mid-fifties with white hair and a full white beard, gray uniform with three stars on the collar, calm and composed expression |
| `longstreet.png` | a heavyset Confederate general in his early forties with a long, full dark-brown beard, gray uniform, stern and brooding expression |
| `hood.png` | a tall Confederate general in his early thirties with a long tawny beard and sad, deep-set eyes, gray uniform |
| `meade.png` | a lean Union general in his late forties with a graying beard, wire spectacles and a hooked nose, dark blue uniform, sharp and irritable expression |
| `sickles.png` | a Union general in his early forties with a thick drooping moustache and no beard, dark blue uniform, confident and theatrical expression |
| `warren.png` | a slight Union general in his early thirties with dark hair and a dark moustache, dark blue uniform, alert and intense expression |
| `chamberlain.png` | a Union colonel in his mid-thirties with a long sweeping moustache and high forehead, dark blue uniform, scholarly and resolute expression |

Parchment texture (16:9, largest size):

> Blank antique map parchment, 1860s survey paper, warm cream and tan, subtle foxing, faint
> fold creases and soft stains, even lighting, flat top-down view, no text, no lines, no drawings.

Title card (optional, 16:9):

> Steel engraving of rolling Pennsylvania farmland with two rocky hills at dusk, split-rail
> fences, drifting cannon smoke, sepia ink on aged paper, wide panorama, no text.

## 8. Demo script (5 minutes)

1. **0:00** The claim: "every commander here is an agent, every decision is Drex."
2. **0:30** NDI: Longstreet's own report becomes a persona, each trait citing its page.
3. **1:15** Autopilot: the afternoon plays out as history recorded it; the ledger shows decisions, latency and cost.
4. **2:30** Take over Sickles, type "hold Cemetery Ridge as ordered"; Drex maps it to a legal order and the battle diverges.
5. **3:30** Click a decision: which traits moved it, with citations.
6. **4:15** Dusk: council of war vote, end state against history, the fidelity score, a short clip of two tabs playing.

## 9. Build order and cut line

| Time (PST) | Work |
|---|---|
| before 11:00 | Plan, sources, Firefly prompts (code only if the rules allow) |
| 11:00 to 11:40 | Scaffold; map graph, order of battle, engine, seeded combat, mock decider |
| 11:40 to 12:20 | Drex client, agent tiers, chain of command, couriers |
| 12:20 to 13:20 | Map UI, unit animation, commander panels, telegram cards |
| 13:20 to 13:50 | NDI persona pipeline with cached results |
| 13:50 to 14:20 | Take-over, typed orders, DeepInfra dispatches, decision ledger |
| 14:20 to 14:40 | Fidelity score, explainability, council of war |
| 14:40 to 15:00 | Portraits in, polish, record the multiplayer clip, submit |

Cut order when time runs short (first to go at the top): multiplayer, council of war,
explainability, reinforcement requests, DeepInfra dispatches (templates stay), brigade agents
(fall back to rule-based).

Never cut: map with moving units, Drex deciding for every commander with visible probabilities,
one human take-over, NDI personas with citations.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Nace key arrives late | Mock mode from the first minute |
| Autopilot does not reproduce history | Fixed seed; persona and standing-order wording tuned against the documented decisions |
| Rate limit (120 per minute, 8 in flight) | Request queue with concurrency 8; one request per agent per turn |
| NDI page caps or slow jobs | Short excerpts; personas cached to disk before the demo |
| Scope against four hours | The cut order above |
| Sensitive subject (Civil War) | Neutral, documentary tone; sources cited |

## 11. Status

- [x] Research on Drex and NDI
- [x] Agent-skills setup (`docs/agents/`, local-markdown issues under `.scratch/`)
- [x] Design settled (rounds 1 to 3, name Clio, rules follow-ups Q27 to Q31)
- [x] Primary sources and map references compiled (`docs/research/gettysburg-sources.md`), with the caveats recorded in section 5.4
- [x] Scaffold: TypeScript, Express + WebSocket server, Vite + React client, shared contract in `shared/types.ts`
- [x] Battle data: 17 map locations, 24 brigades, 7 commanders with cited authored personas (`server/data/gettysburg.ts`)
- [x] Engine: three agent tiers, chain of command, protests and rulings, Warren's call, couriers, seeded combat, routs, wounds, end state (`server/game.ts`)
- [x] Decider: live Drex client with model discovery, retries and a concurrency cap, plus the offline mock (`server/decider.ts`)
- [x] Offline run verified (`npx tsx server/scripts/sim.ts`): about 205 decisions per battle; with the mock decider 10 of 10 checkpoints and 5 of 5 objectives match 1863. This proves the engine, not Drex.
- [x] Human take-over, typed orders mapped by the decider, explain-by-ablation, council of war, after-action report: server side written, not yet exercised through the UI
- [x] Scripts written, not yet run (need keys): `npm run personas` (NDI), `npm run fidelity`, `server/scripts/measure.ts`
- [x] Map UI (`web/`): title screen, SVG campaign map, marching units, couriers, commander panels, order sheet, telegraph, ledger, timeline, explain card, end plate. Checked in the browser on the mock decider: it loads, a full battle animates, no console errors. Not yet checked: the whole layout at 1920x1080 on a projector, and the order sheet, explain card and end plate by hand.
- [x] Server flows checked through the API on the mock decider: take-over, typed order ("Hold Cemetery Ridge as ordered" mapped to obey), council of war, template after-action report
- [x] README, LICENSE, pitch outline (`docs/pitch.md`), dev launch config
- [x] Keys in `.env` (git-ignored, never printed); `DECIDER=drex`
- [x] Live Drex verified: `drex-max-v1.1`, one battle is about 170 decisions in about 18 seconds for about $0.0019
- [x] Questions reworked after the first live run (it kept brigades and reserves waiting because the state hid facts a commander would know): echelon timing is put as a judgement with the right-hand brigade's status, Meade gets a report on each threatened point, Chamberlain is told his crisis
- [x] Live autopilot result (seed 1863, authored personas): 9 of 10 documented decisions match and all 5 key positions end as in 1863. The miss: Longstreet delays before obeying (his own report says "I delayed")
- [x] DeepInfra verified (`Qwen/Qwen3.8-27B`)
- [x] Intern verified on Windows with the shim: a headless task read a file and wrote a file, Drex as System 1
- [x] NDI personas built for 6 of 7 commanders from scanned volumes on archive.org, each trait with a verbatim quote and page (Lee, Longstreet, Hood, Sickles, Warren, Chamberlain). Meade's main report timed out on the 105 MB volume and he keeps the authored persona unless the council-minutes job lands. The clean-text sites and the handwritten Chamberlain scan answer NDI's fetcher with 403.
- [x] Fidelity on live Drex (`data/fidelity.json`, seed 1863): **8 of 9** documented decisions reproduced with the NDI personas, **6 of 8** without. Without his persona Hood simply obeys, so the protest and Longstreet's ruling never happen. Caveat for the pitch: Drex clearly knows these commanders by name (Sickles advances even with no persona), so the persona is not the only source of the behaviour.
- [x] Measured comparison (`data/measured.json`), the same 30 decisions: Drex `drex-max-v1.1` median 355 ms, $0.00041 total. `Qwen/Qwen3.8-27B` on DeepInfra with reasoning off: 594 ms, $0.0029, agreeing with Drex on 29 of 30. With reasoning on (the model's default): 9,544 ms, $0.0315. So about 7 times cheaper than the same-size LLM at its fastest, 77 times cheaper and 27 times faster than it thinking.
- [x] In the browser on live Drex: took Sickles (Drex gave 97% that he advances), typed "Hold Cemetery Ridge as ordered", Drex read it as "obeys" at 97%, history diverged. Explain card data verified through the API (removing Lee's "has declined the flank march" moves his choice by 6 points).
- [x] Dispatch lines from DeepInfra, with `reasoning_effort: none` (about 1 s each)
- [x] Council of war on live Drex: 6 of 9 to stay in one run (history was unanimous)
- [x] After-action report written by Intern from a full live run (46 seconds; file `after-action.md` in the run folder). Seen on disk, not yet in the UI card.
- [x] Units drawn as formations of soldiers (one dot is about fifty men): column of fours on the road, four-rank line in position, wavering and routing, losses one man at a time, no enclosing outlines (`web/src/components/TroopCanvas.tsx`)
- [x] Detailed countryside layer on the map: relief, streams, woods, fields, 22 named farms, minor roads, walls, the town (`web/src/components/Countryside.tsx`). A schematic, not a survey.
- [x] Ground affects movement (user request): march time per road depends on road or cross-country, the terrain entered, fords and fatigue; a column can end the half hour part-way along the road and is shown there with the reason. The battle now starts at 2:30 PM with 11 turns so the attack still develops before dusk.
- [x] Commanders react to what has actually happened (user request: a player's non-historical decision should be met in character, as at the time). Every commander's state now carries the news of the field a general would have had: his own side's orders, refusals and protests, reserves sent, and ground taken or lost (seen by both sides). Nothing says a choice was a player's. A subordinate who sets his order aside is reported to his superior the next half hour, and the superior decides in character whether to let it stand or order him back. Tested on live Drex: playing Hood and going around the Round Tops, Longstreet heard of it at 3:30 and let it stand (58%), in keeping with his own earlier wish for that move. Autopilot unchanged.
- [x] Fight on past dusk (user request). At 8:00 PM the engine judges whether the field is decided: one side holds every key position, or one side has fewer than one man in four still in the ranks. If not (as in 1863), "Fight on" continues the battle with the same agents until it is decided, both armies stand still for an hour, or about 2:00 AM. The report and council are redone for the new ending. Tested on live Drex: undecided at dusk, fought on, ended at midnight with the field divided.
- [x] A general held by a player is asked every half hour (user report: holding Lee, only one order came). Lee may keep or change the plan each half hour, and a change goes to Longstreet by courier; any held general orders his own waiting brigades on one sheet. Drex's generals behave as before (autopilot still reproduces all ten documented decisions on the mock decider).
- [x] Simpler screens (user request: the interface was overloaded when taking actions or reading cards). Order sheet: one question, the choices as plain buttons, a single "likely in 1863" mark, writing your own order folded away. Reserve orders: pre-set to the likeliest choice, one "Send orders". Commander panels: the latest decision in one line. Battle card: one line per brigade. Ledger: three figures, details folded. Explanation card: full odds folded. A banner at the top of the map always says what to do next ("Your order is waiting.", "Press Let history run, or first take command of a general.").
- [x] Assistant attribution removed from the repository and its history at the user's request (no co-author trailers; agent configuration files kept out of version control).
- [x] Map zoom (user request): mouse wheel zooms about the pointer up to 5×, drag pans, double-click or "Whole field" resets; at 1× the view is unchanged. SVG layers zoom through their viewBox and the soldiers' canvas draws through the same window, so both stay sharp. Labels grow more slowly than the map, and from 1.8× each unit shows its commander, morale, ammunition, fatigue and order. Hover and battle cards follow the zoom; the hover card now anchors to a marching column's actual place on the road. (`web/src/useMapView.ts`)
- [x] After-action report fixed (user report: it stayed on "being written"). Intern wrote the file but did not exit, so the server waited out its five-minute limit. Now the file is taken as soon as it stops growing, the report starts on its own at dusk, and Intern runs with PYTHONUTF8=1 (it crashed printing ✗ on the Windows console). Measured: battle ended 13:39:34, Intern's 481-word report ready about two minutes later.
- [x] Portraits: Intern chose a wartime, public-domain photograph for each of the seven from Wikimedia Commons candidates (one Intern run per commander, URLs taken from the Commons data, not from the model). Checked by eye; framed on the face in each oval. Credits in `web/public/portraits/credits.json`. Firefly portraits are no longer needed.
- [x] Battle card: tapping the crossed sabres on a contested place shows both sides of that fight (`web/src/components/BattleCard.tsx`)
- [x] Decision ledger moved to the footer so the side columns are all commanders
- [x] In-app page "How it works" (`web/src/components/HowItWorks.tsx`): parts, architecture diagram, one half hour, a worked decision, document to commander, measured figures. Linked from the top bar and the title screen; address `#how-it-works`.
- [x] Fidelity re-measured after the movement change (live Drex, seed 1863): 8 of 9 documented decisions with NDI personas, 7 of 8 without. Ground at dusk: 3 of 5 key positions as in 1863 with personas, 5 of 5 without. The personas change behaviour (Hood protests, as he did; without one he goes around the Round Tops) but do not make the outcome more accurate. The pitch outline says so.
- [ ] By-hand look at the whole layout at 1920x1080, the explain card and the end plate
- [ ] Adobe (user's call, 14:40): deck exported as PPTX, finished in Adobe Express, cover art from Firefly. README, deck and pitch claim this; drop the claims if it is not done.
- [ ] Team registered; presentation; README; push; Finalize
- [ ] Multiplayer tab recording (the server already supports a second tab claiming a commander)
