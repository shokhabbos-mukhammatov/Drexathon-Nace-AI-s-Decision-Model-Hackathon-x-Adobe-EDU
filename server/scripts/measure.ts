// Measured comparison: the same decisions, put to Drex and to a general LLM on DeepInfra.
//   npx tsx --env-file=.env server/scripts/measure.ts [count]
// Records real decision requests from one battle, replays them against both, and writes
// data/measured.json (median time per decision, total cost, agreement). The ledger shows it.
import fs from 'node:fs';
import path from 'node:path';
import { createDecider, type AskRequest, type AskResult, type Decider } from '../decider.ts';
import { Game } from '../game.ts';
import { chat, deepinfraModel, hasDeepInfra } from '../llm.ts';

const COUNT = Number(process.argv[2]) || 30;
// Pass 'reasoning' as the second argument to let the LLM think first (its default, and far slower).
const REASON = process.argv[3] === 'reasoning';
const inner = await createDecider();
if (!hasDeepInfra()) { console.error('DEEPINFRA_API_KEY is not set.'); process.exit(1); }

const recorded: { req: AskRequest; res: AskResult }[] = [];
const recorder: Decider = {
  mode: inner.mode, model: inner.model,
  async ask(req) { const res = await inner.ask(req); if (req.questions.length === 1) recorded.push({ req, res }); return res; },
};
const game = new Game(recorder, () => {});
game.reset(1863, true);
while (game.state.phase !== 'ended' && recorded.length < COUNT * 2) await game.step();
const sample = recorded.slice(0, COUNT);
console.log(`recorded ${sample.length} single-question decisions from a ${inner.mode} run`);

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const llmMs: number[] = []; let llmCost = 0; let agree = 0; let answered = 0; let parsed = 0;
for (const { req, res } of sample) {
  const q = req.questions[0];
  const prompt = `You are deciding for a commander in a historical simulation.\n\nSTATE:\n${JSON.stringify(req.state, null, 1)}\n\nQUESTION: ${q.instructions}\n\nOPTIONS:\n${q.options.map((o) => `- ${o.id}: ${o.description}`).join('\n')}\n\nReply with JSON only: {"choice": "<one option id>"}`;
  try {
    const out = await chat([{ role: 'user', content: prompt }], { maxTokens: REASON ? 3000 : 200, temperature: 0, timeoutMs: 90_000, reasoning: REASON ? undefined : 'none' });
    if (!out) continue;
    llmMs.push(out.usage.ms); llmCost += out.usage.costUsd; answered++;
    const pick = q.options.find((o) => out.text.includes(`"${o.id}"`))?.id;
    if (pick) parsed++;
    if (pick === res.answers[q.id].chosen) agree++;
    process.stdout.write('.');
  } catch (e) { process.stdout.write('x'); }
}
// Keep the earlier reasoning-on measurement beside this one, if there was one.
let prior: unknown;
try { const m = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'measured.json'), 'utf8')); prior = m.with_reasoning ?? (String(m.model).includes('reasoning off') ? undefined : { model: m.model, decisions: m.decisions, medianMs: m.medianMs, costUsd: m.costUsd }); } catch { /* first run */ }
const drexMs = sample.map((s) => s.res.latencyMs); const drexCost = sample.reduce((a, s) => a + s.res.costUsd, 0);
const out = {
  model: `${deepinfraModel()} on DeepInfra, ${REASON ? 'reasoning on' : 'reasoning off'}`, decisions: answered, medianMs: median(llmMs), costUsd: llmCost,
  drex: { model: inner.model, mode: inner.mode, medianMs: median(drexMs), costUsd: drexCost }, parsed, agreement: parsed ? agree / parsed : 0,
  ran_at: new Date().toISOString(),
  ...(prior ? { with_reasoning: prior } : {}),
};
fs.writeFileSync(path.join(process.cwd(), 'data', 'measured.json'), JSON.stringify(out, null, 1));
console.log(`\n${JSON.stringify(out, null, 1)}\nwrote data/measured.json`);
process.exit(0);
