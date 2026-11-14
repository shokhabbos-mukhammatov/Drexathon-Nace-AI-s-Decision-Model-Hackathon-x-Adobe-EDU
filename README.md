# Clio

**Stand where they stood.** A staff ride at software speed.

Military schools and leadership courses walk the Gettysburg battlefield to study how commanders
decided under pressure. It takes a trip, a historian and a day. Clio gives any classroom or
training course that exercise: a historical battle replayed on a period map by a swarm of
agents, each built from that commander's own documents. Left alone, the agents replay the
afternoon. Take any commander's place, give a different order, and see what history would
have done with it.

Built at Drexathon (Nace AI x Adobe EDU), November 14, 2026. Track: Swarm Intelligence.

## What each tool does

| Tool | Job in Clio |
|---|---|
| **Drex** (Nace decision model) | Makes every agent decision: about 200 per battle across three tiers (army, corps and division, brigade). Each is a typed `choice` with a probability for every option, shown on screen. It also reads a player's typed order and maps it to a legal move, and powers "why?" by re-asking with one trait removed. |
| **NDI** (Nace Document Intelligence) | Reads each commander's reports, letters and testimony and extracts his persona, with the page and quote for every trait (`npm run personas`). |
| **Intern** (Nace agent harness) | Writes the after-action report from the battle's decision log, running headless with Drex as its System 1 and a DeepInfra model as its System 2 (`server/report.ts`). It also chose each commander's portrait: given the candidate images from Wikimedia Commons with their dates and licences, it picked a public-domain photograph of the man alone, taken in his lifetime. |
| **DeepInfra** | Hosts the one generative model, which only writes words: the one-line dispatch after Drex has decided, and the report. |
| **Adobe Firefly** | Parchment texture and title art (optional). |

Code owns everything that should not be a judgement: the map, legal moves, movement, combat
arithmetic (seeded, so a run is repeatable) and the turn sequence.

## The battle

Gettysburg, July 2, 1863, 2:30 PM to dusk, on the southern end of the field: 17 locations,
24 brigades, 7 commanders with personas (Lee, Longstreet, Hood, Meade, Sickles, Warren,
Chamberlain). Strengths, positions, the timeline and the documented decisions are sourced in
[docs/research/gettysburg-sources.md](docs/research/gettysburg-sources.md). Another battle is
another data file like [server/data/gettysburg.ts](server/data/gettysburg.ts).

Ground matters: how far a column gets in a half hour depends on the road, the terrain it is
entering (woods, boulders, a steep slope), any stream it has to ford, and how tired the men
are, so a brigade is often still on the road when the half hour ends.

How the agents coordinate:

- **Chain of command.** Lee and Meade set objectives. Their subordinates decide whether to obey, delay, protest or act on their own judgement.
- **Protest and ruling.** A protest goes up the chain and the superior rules on it (Hood to Longstreet: "We must obey the orders of General Lee").
- **Calls for help.** Warren, finding Little Round Top empty, sends for troops; each brigade commander decides for himself whether to answer.
- **Brigades in contact** decide each half hour whether to press, stand, countercharge or fall back.
- **Council of war.** At dusk Meade's generals vote, as they did that night.

The run is scored against ten documented decisions ("history fidelity") and against who held
the key ground at nightfall.

## Run it

Needs Node 22 or later.

```bash
npm install
cp .env.example .env    # then add NACE_API_KEY and DEEPINFRA_API_KEY
npm run dev             # http://localhost:5173
```

Without keys it runs on an offline mock decider, clearly labelled, so the engine and interface
can be tried anywhere.

## Playing it

- A banner at the top of the map always says what to do next.
- **Let history run** plays the afternoon; **Take command** on any general's panel puts you in his place. A general you hold is asked every half hour (Lee, for instance, may keep or change the plan of attack, and orders his own brigades). When it is your turn an order sheet opens: pick one of the choices (the one marked "likely in 1863" is what Drex expects the real general to do), or write the order in your own words.
- Tap the crossed sabres on a fight to see both sides; tap "why?" on a decision to see which traits moved it.
- At dusk, **The field at nightfall** shows the ground against 1863, the council of war and Intern's after-action report.

On the map, scroll to zoom (up to 5×) and drag to move; double-click the map or press "Whole field" to return to the full view. Zoomed in, each unit also shows its commander, morale, ammunition, fatigue and current order.

The app explains itself: **How it works** in the top bar (or `http://localhost:5173/#how-it-works`)
opens a page with the parts, an architecture diagram, the sequence of one half hour, a worked
decision, the document-to-commander pipeline and the measured figures.

| Command | What it does |
|---|---|
| `npm run dev` | Server (port 8787) and web client (port 5173) |
| `npm run personas` | Build the personas from the primary sources with NDI Extract into `data/personas/` |
| `npm run fidelity` | Autopilot with and without personas; writes `data/fidelity.json` |
| `npx tsx --env-file=.env server/scripts/measure.ts` | The same decisions on Drex and on a general LLM, timed and costed; writes `data/measured.json` |
| `npx tsx server/scripts/sim.ts` | One headless battle printed to the terminal |

## Layout

```
shared/types.ts      the contract between server and client
server/game.ts       the engine and the agents
server/decider.ts    Drex client and the offline mock
server/report.ts     after-action report (Intern, then DeepInfra, then a template)
server/llm.ts        DeepInfra client
server/data/         the battle
web/                 React client: SVG campaign map, commander panels, ledger
docs/plan.md         design decisions and status
```

## Known limits

- Intern imports Unix-only modules and does not start on Windows without the small shim in `tools/intern-windows-shim/`. If Intern is missing or fails, the report is written by the same DeepInfra model called directly, and the report says so.
- The scanned Official Records volumes are 60 to 105 MB; the persona builder uses verified clean-text copies of the same pages where they exist, and the handwritten Chamberlain report as the scanned example.
- Sickles, Hood and Warren left no report for the day; their sources are later and self-justifying.

## Portraits

Wartime photographs from Wikimedia Commons (mostly the Library of Congress and Brady's studio), all public domain, chosen by Intern from candidates with their dates and licences and checked by eye. Source page, date, credit and the reason for each choice are in [web/public/portraits/credits.json](web/public/portraits/credits.json).

## License

MIT. Source documents are public domain; see the research file for each one's origin.
