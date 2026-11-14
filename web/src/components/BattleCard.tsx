import { memo, useMemo } from 'react';
import { motion } from 'motion/react';
import type { GameState, MapNode, Side, Unit } from '../../../shared/types';
import { MAP_H, MAP_W, clock12, fmtInt, pct } from '../geo';

// Opened from the crossed sabres on a place that is being fought over: the two sides of that
// one fight, set against each other.

const SIDE_WORD: Record<Side, string> = { confederate: 'Confederate', union: 'Union' };
const TERRAIN_WORD: Record<string, string> = {
  open: 'open ground', farm: 'farm fields', woods: 'woods', rocks: 'boulders', ridge: 'a ridge', hill: 'a steep, rocky hill',
};

function Bar({ value, tone }: { value: number; tone?: 'warn' }) {
  const v = Math.max(0, Math.min(100, Math.round(value ?? 0)));
  return (
    <i className="bc-bar">
      <b style={{ width: v + '%', background: tone === 'warn' && v < 35 ? '#9c2f25' : undefined }} />
    </i>
  );
}

function BattleCardImpl({ state, node, at, onClose }: { state: GameState; node: MapNode; at?: [number, number]; onClose: () => void }) {
  const info = useMemo(() => {
    const here = (state.units ?? []).filter((u) => u.nodeId === node.id && u.strength > 0 && !u.inReserve);
    const sides: Side[] = ['confederate', 'union'];
    const decisions = state.decisions ?? [];
    const lastChoice = (u: Unit) => {
      for (let i = decisions.length - 1; i >= 0; i--) {
        const d = decisions[i];
        if (d.kind !== 'reaction') continue;
        if (d.unitId === u.id || (u.agentId && d.agentId === u.agentId)) {
          const o = d.options.find((x) => x.id === d.chosen);
          return o ? { label: o.label, p: o.p, clock: d.clock } : null;
        }
      }
      return null;
    };
    const cols = sides.map((side) => {
      const units = here.filter((u) => u.side === side);
      const fighting = units.filter((u) => u.status !== 'routed');
      const men = fighting.reduce((a, u) => a + u.strength, 0);
      const began = units.reduce((a, u) => a + u.strength0, 0);
      const morale = men ? fighting.reduce((a, u) => a + u.morale * u.strength, 0) / men : 0;
      return { side, units: units.map((u) => ({ u, choice: lastChoice(u) })), men, lost: began - units.reduce((a, u) => a + u.strength, 0), morale };
    });
    const reports = (state.events ?? []).filter((e) => e.kind === 'clash' && e.nodeId === node.id).slice(-3).reverse();
    const holder = state.objectives?.find((o) => o.nodeId === node.id);
    const [c, u] = cols;
    const odds = c.men && u.men ? (c.men >= u.men ? { side: c.side, r: c.men / u.men } : { side: u.side, r: u.men / c.men }) : null;
    return { cols, reports, holder, odds };
  }, [state.units, state.decisions, state.events, state.objectives, node.id]);

  // `at` is the marker's place on screen when the map is zoomed.
  const left = ((at?.[0] ?? node.x) / MAP_W) * 100;
  const top = ((at?.[1] ?? node.y) / MAP_H) * 100;
  const flipX = left > 55;
  const flipY = top > 50;

  return (
    <motion.div
      className="battle-card"
      style={{
        left: flipX ? undefined : `calc(${left}% + 30px)`,
        right: flipX ? `calc(${100 - left}% + 30px)` : undefined,
        top: flipY ? undefined : `calc(${top}% - 20px)`,
        bottom: flipY ? `calc(${100 - top}% - 20px)` : undefined,
      }}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-label={`The fight for ${node.name}`}
    >
      <header className="bc-head">
        <div>
          <span className="bc-kicker">The fight for</span>
          <strong>{node.name}</strong>
        </div>
        <button type="button" className="bc-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <p className="bc-ground">
        {clock12(state.clock)} · fought over {TERRAIN_WORD[node.terrain] ?? node.terrain}
        {node.defense > 1.05 ? `, which favours the defender (×${node.defense.toFixed(2)})` : node.defense < 0.98 ? ', which offers the defender nothing' : ''}
        {info.odds && info.odds.r >= 1.08 ? `. ${info.odds.side === 'union' ? 'The Union has' : 'The Confederates have'} ${info.odds.r.toFixed(1)} men to one.` : info.odds ? '. The numbers are about even.' : '.'}
      </p>

      <div className="bc-sides">
        {info.cols.map((col) => (
          <section key={col.side} className={`bc-side side-${col.side}`}>
            <h3>{SIDE_WORD[col.side]}</h3>
            <div className="bc-total">
              <b>{fmtInt(col.men)}</b> men
              <span>{col.lost > 0 ? `${fmtInt(col.lost)} lost` : 'no losses yet'}</span>
            </div>
            <div className="bc-row bc-row-total">
              <span>Morale</span>
              <Bar value={col.morale} tone="warn" />
            </div>
            {col.units.map(({ u, choice }) => (
              <div key={u.id} className={`bc-unit ${u.status === 'routed' ? 'is-routed' : ''}`}>
                <div className="bc-unit-head">
                  <strong>{u.short || u.name}</strong>
                  <em>
                    {fmtInt(u.strength)} of {fmtInt(u.strength0)}
                  </em>
                </div>
                                <div className="bc-choice">
                  {u.status === 'routed' ? 'Broken and streaming to the rear' : choice ? (
                    <>
                      {choice.label} <small>Drex {pct(choice.p)}</small>
                    </>
                  ) : 'Coming into action'}
                </div>
              </div>
            ))}
            {col.units.length === 0 && <p className="bc-none">None on the ground.</p>}
          </section>
        ))}
      </div>

      {info.reports.length > 0 && false && (
        <div className="bc-reports">
          <h3>Reports from this fight</h3>
          {info.reports.map((e) => (
            <p key={e.id}>
              <span>{clock12(e.clock)}</span> {e.text.replace(`${node.name}: `, '')}
            </p>
          ))}
        </div>
      )}
      {info.holder && (
        <p className="bc-history">
          In 1863 this ground was {info.holder.historical === 'contested' ? 'still disputed' : info.holder.historical === 'union' ? 'in Union hands' : info.holder.historical === 'confederate' ? 'in Confederate hands' : 'unheld'} at nightfall.
        </p>
      )}
    </motion.div>
  );
}

export const BattleCard = memo(BattleCardImpl);
