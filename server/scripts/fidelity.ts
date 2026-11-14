// History fidelity: let the agents fight the afternoon on autopilot, with and without their
// personas, and count how many documented decisions they reproduce.
//   npm run fidelity
// Writes data/fidelity.json, which the server shows beside the live score.
import fs from 'node:fs';
import path from 'node:path';
import { createDecider } from '../decider.ts';
import { Game } from '../game.ts';

const decider = await createDecider();
console.log(`decider: ${decider.mode} (${decider.model})`);

async function run(personas: boolean) {
  const game = new Game(decider, () => {});
  game.reset(1863, personas);
  while (game.state.phase !== 'ended') await game.step();
  const f = game.state.fidelity;
  console.log(`\n${personas ? 'WITH' : 'WITHOUT'} personas: ${f.matched} of ${f.decided} documented decisions reproduced`);
  for (const c of f.checkpoints) console.log(`  ${c.matched === undefined ? '--' : c.matched ? 'OK' : 'XX'} ${c.label}: ${c.actualLabel ?? '(not reached)'}  [1863: ${c.historicalLabel}]`);
  return { matched: f.matched, total: f.decided, objectives: game.state.objectives, ledger: game.state.ledger };
}

const withPersona = await run(true);
const withoutPersona = await run(false);
const out = {
  ran_at: new Date().toISOString(), decider: decider.mode, model: decider.model,
  withPersona: { matched: withPersona.matched, total: withPersona.total },
  withoutPersona: { matched: withoutPersona.matched, total: withoutPersona.total },
  detail: { withPersona, withoutPersona },
};
fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), 'data', 'fidelity.json'), JSON.stringify(out, null, 1));
console.log('\nwrote data/fidelity.json');
process.exit(0);
