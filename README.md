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
| **Intern** (Nace agent harness) | Writes the after-action report from the battle's decision log, running headless with Drex as its System 1 and a DeepInfra model as its System 2 (`server/report.ts`). |
| **DeepInfra** | Hosts the one generative model, which only writes words: the one-line dispatch after Drex has decided, and the report. |
| **Adobe Firefly** | Commander portraits, parchment texture and title art. |

Code owns everything that should not be a judgement: the map, legal moves, movement, combat
arithmetic (seeded, so a run is repeatable) and the turn sequence.

## The battle

Gettysburg, July 2, 1863, 3:00 PM to dusk, on the southern end of the field: 17 locations,
24 brigades, 7 commanders with personas (Lee, Longstreet, Hood, Meade, Sickles, Warren,
Chamberlain). Strengths, positions, the timeline and the documented decisions are sourced in
[docs/research/gettysburg-sources.md](docs/research/gettysburg-sources.md). Another battle is
another data file like [server/data/gettysburg.ts](server/data/gettysburg.ts).

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

## License

MIT. Source documents are public domain; see the research file for each one's origin.
