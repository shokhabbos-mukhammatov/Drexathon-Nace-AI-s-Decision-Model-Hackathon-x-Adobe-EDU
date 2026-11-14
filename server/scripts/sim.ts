// Headless run of one battle, for checking the engine: npx tsx server/scripts/sim.ts [seed] [nopersona]
import { createDecider } from '../decider.ts';
import { Game } from '../game.ts';

const seed = Number(process.argv[2]) || 1863;
const personas = process.argv[3] !== 'nopersona';
const decider = await createDecider();
const game = new Game(decider, () => {});
game.reset(seed, personas);
let printed = 0;
while (game.state.phase !== 'ended') {
  await game.step();
  for (const e of game.state.events.slice(printed)) console.log(`${e.clock} [${e.kind}] ${e.text}`);
  printed = game.state.events.length;
}
console.log('\nOBJECTIVES'); for (const o of game.state.objectives) console.log(` ${o.name}: ${o.holder} (1863: ${o.historical})`);
console.log('\nCHECKPOINTS'); for (const c of game.state.fidelity.checkpoints) console.log(` ${c.matched === undefined ? '--' : c.matched ? 'OK' : 'XX'} ${c.label}: ${c.actualLabel ?? '(not reached)'}`);
console.log('\nUNITS'); for (const u of game.state.units) console.log(` ${u.side[0]} ${u.short.padEnd(13)} ${String(u.strength).padStart(5)}/${u.strength0} m${Math.round(u.morale)} a${u.ammo} ${u.status} @${u.nodeId}`);
console.log('\nLEDGER', JSON.stringify(game.state.ledger), 'CASUALTIES', JSON.stringify(game.state.casualties));
process.exit(0);
