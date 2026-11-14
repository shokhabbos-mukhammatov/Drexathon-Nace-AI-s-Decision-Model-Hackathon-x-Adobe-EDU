import { memo, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { GameState } from '../../../shared/types';
import { addMinutes, clock12, clockMinutes } from '../geo';

/** Minutes of battle per turn, inferred from any two clock readings in the state. */
function minutesPerTurn(state: GameState): number {
  const seen = new Map<number, number>();
  const note = (turn: number | undefined, clock: string | undefined) => {
    const m = clockMinutes(clock ?? '');
    if (m !== null && typeof turn === 'number' && !seen.has(turn)) seen.set(turn, m);
  };
  note(state.turn, state.clock);
  for (const d of state.decisions ?? []) note(d.turn, d.clock);
  for (const e of state.events ?? []) note(e.turn, e.clock);
  const pairs = [...seen.entries()].sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < pairs.length; i++) {
    const dt = pairs[i][0] - pairs[i - 1][0];
    const dm = pairs[i][1] - pairs[i - 1][1];
    if (dt > 0 && dm > 0) return dm / dt;
  }
  return 30;
}

function TimelineImpl({ state, onShowCheckpoints }: { state: GameState; onShowCheckpoints?: () => void }) {
  const [open, setOpen] = useState(false);
  const max = Math.max(1, state.maxTurns ?? 1);
  const turn = Math.max(0, Math.min(max, state.turn ?? 0));
  const mpt = useMemo(() => minutesPerTurn(state), [state]);
  const start = addMinutes(state.clock ?? '00:00', -turn * mpt);
  const ticks = Array.from({ length: max + 1 }, (_, i) => i);
  const labelEvery = max > 12 ? 3 : max > 6 ? 2 : 1;

  const f = state.fidelity ?? { checkpoints: [], matched: 0, decided: 0 };
  const decided = f.decided ?? 0;
  const matched = f.matched ?? 0;
  const diverged = Math.max(0, decided - matched);
  const total = Math.max(f.checkpoints?.length ?? 0, decided, 1);
  const share = decided > 0 ? diverged / decided : 0;

  return (
    <section className="timeline" aria-label="Timeline and divergence from history">
      <div className="tl-track" role="img" aria-label={`Turn ${turn} of ${max}, ${clock12(state.clock)}`}>
        <div className="tl-line" />
        <div className="tl-done" style={{ width: `${(turn / max) * 100}%` }} />
        {ticks.map((i) => (
          <span key={i} className={`tl-tick ${i <= turn ? 'is-past' : ''} ${i === max ? 'is-dusk' : ''}`} style={{ left: `${(i / max) * 100}%` }}>
            {(i % labelEvery === 0 || i === max) && <em>{i === max && !state.extended ? 'dusk' : clock12(addMinutes(start, i * mpt)).replace(':00', '').replace(' PM', 'p').replace(' AM', 'a')}</em>}
          </span>
        ))}
        <motion.span className="tl-now" animate={{ left: `${(turn / max) * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }}>
          <svg viewBox="0 0 16 22" width="16" height="22" aria-hidden="true">
            <path d="M8 21L1.5 8.5a6.6 6.6 0 1 1 13 0z" fill="#a8843a" stroke="#2b2118" strokeWidth="1.2" />
            <circle cx="8" cy="7.5" r="2.2" fill="#2b2118" />
          </svg>
        </motion.span>
      </div>

      <button
        type="button"
        className="diverge"
        onClick={() => {
          setOpen((v) => !v);
          onShowCheckpoints?.();
        }}
        aria-expanded={open}
        title="Documented decisions of the day, and whether this run repeated them"
      >
        <span className="dv-head">
          <strong>History divergence</strong>
          <span>
            {decided === 0 ? 'no documented decision reached yet' : `${matched} of ${decided} as in 1863`}
            {decided > 0 && diverged > 0 ? `, ${diverged} changed` : ''}
          </span>
        </span>
        <span className="dv-gauge">
          {Array.from({ length: total }, (_, i) => {
            const cp = f.checkpoints?.[i];
            const cls = cp?.matched === true ? 'is-match' : cp?.matched === false ? 'is-diverged' : 'is-open';
            return <i key={i} className={cls} />;
          })}
        </span>
        <span className="dv-scale">
          <em>as recorded</em>
          <motion.b animate={{ left: `${share * 100}%` }} transition={{ type: 'spring', stiffness: 90, damping: 16 }} />
          <em>rewritten</em>
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div className="checkpoints" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.2 }}>
            <CheckpointList state={state} />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function CheckpointList({ state }: { state: GameState }) {
  const cps = state.fidelity?.checkpoints ?? [];
  if (cps.length === 0) return <p className="cp-empty">No documented decisions are on file for this battle.</p>;
  return (
    <ol className="cp-list">
      {cps.map((c) => (
        <li key={c.id} className={c.matched === true ? 'is-match' : c.matched === false ? 'is-diverged' : 'is-open'}>
          <span className="cp-mark" aria-hidden="true">
            {c.matched === true && (
              <svg viewBox="0 0 20 20" width="18" height="18">
                <path d="M3 11.5c2 1.6 3.3 3.2 4.4 5.2C9.6 11 12.6 6.6 17.4 3" fill="none" stroke="#2b2118" strokeWidth="2.1" strokeLinecap="round" />
              </svg>
            )}
            {c.matched === undefined && <span className="cp-dot" />}
          </span>
          <span className="cp-body">
            <strong>{c.label}</strong>
            <span className="cp-hist">1863: {c.historicalLabel}</span>
            {c.actualLabel && c.matched === false && <span className="cp-now">This run: {c.actualLabel}</span>}
          </span>
          {c.matched === false && <span className="stamp stamp-diverged">Diverged</span>}
        </li>
      ))}
    </ol>
  );
}

export const Timeline = memo(TimelineImpl);
