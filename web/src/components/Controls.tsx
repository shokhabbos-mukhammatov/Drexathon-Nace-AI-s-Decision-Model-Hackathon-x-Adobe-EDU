import { memo, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { GameState } from '../../../shared/types';
import { clock12 } from '../geo';

const SPEEDS: { id: string; label: string; ms: number }[] = [
  { id: 'slow', label: 'Walk', ms: 5200 },
  { id: 'normal', label: 'March', ms: 3200 },
  { id: 'fast', label: 'Gallop', ms: 1700 },
];

interface Props {
  state: GameState;
  connected: boolean;
  awaitingMe: boolean;
  post: (path: string, body?: unknown) => Promise<unknown>;
  onShowEnd: () => void;
  onShowTitle: () => void;
  onShowHow: () => void;
}

function ControlsImpl({ state, connected, awaitingMe, post, onShowEnd, onShowTitle, onShowHow }: Props) {
  const [speed, setSpeed] = useState('normal');
  const [menu, setMenu] = useState(false);
  const [seed, setSeed] = useState(String(state.seed ?? 1863));
  const [personas, setPersonas] = useState(state.personas !== false);
  const menuRef = useRef<HTMLDivElement>(null);
  const ended = state.phase === 'ended';
  const busy = state.phase === 'deciding' || state.phase === 'resolving';
  const ms = SPEEDS.find((s) => s.id === speed)?.ms ?? 3200;

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menu]);

  const pickSpeed = (id: string) => {
    setSpeed(id);
    const next = SPEEDS.find((s) => s.id === id)?.ms ?? 3200;
    if (state.auto) void post('auto', { on: true, delayMs: next });
  };

  return (
    <header className="bar">
      <button type="button" className="brand" onClick={onShowTitle} title="Back to the title plate">
        <span className="brand-name">Clio</span>
        <span className="brand-sub">
          {state.battle}
          <i>{state.date}</i>
        </span>
      </button>

      <div className="bar-mid">
        <div className="clockface" aria-live="polite">
          <strong>{clock12(state.clock)}</strong>
          <span>
            {ended ? 'nightfall' : busy ? (state.phase === 'deciding' ? 'commanders deciding' : 'the lines meet') : awaitingMe ? 'your order is waiting' : `turn ${state.turn} of ${state.maxTurns}`}
          </span>
        </div>

        <div className="transport">
          <button type="button" className={`btn-seal ${state.auto ? 'is-on' : ''}`} disabled={ended} onClick={() => post('auto', { on: !state.auto, delayMs: ms })}>
            {state.auto ? (
              <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                <path d="M3 2h3.6v12H3zM9.4 2H13v12H9.4z" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                <path d="M3.5 1.8l10 6.2l-10 6.2z" fill="currentColor" />
              </svg>
            )}
            {state.auto ? 'Halt' : state.turn > 0 ? 'Resume the day' : 'Let history run'}
          </button>
          <button type="button" className="btn-ink" disabled={ended || busy || state.auto} onClick={() => post('step', {})}>
            Advance one turn
          </button>
          <div className="speed" role="radiogroup" aria-label="Pace">
            {SPEEDS.map((s) => (
              <button key={s.id} type="button" role="radio" aria-checked={speed === s.id} className={speed === s.id ? 'is-on' : ''} onClick={() => pickSpeed(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bar-end">
        {ended && state.canFightOn && (
          <button type="button" className="btn-seal" onClick={() => post('continue', {})} title="Keep fighting past dusk until the field is decided">
            Fight on
          </button>
        )}
        {ended && (
          <button type="button" className="btn-ink" onClick={onShowEnd}>
            The field at nightfall
          </button>
        )}
        <button type="button" className="btn-ghost" onClick={onShowHow}>
          How it works
        </button>
        <div className="newgame" ref={menuRef}>
          <button type="button" className="btn-ghost" onClick={() => setMenu((v) => !v)} aria-expanded={menu}>
            New battle
          </button>
          <AnimatePresence>
            {menu && (
              <motion.div className="newgame-sheet" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}>
                <h3>Begin the afternoon again</h3>
                <label className="field">
                  <span>Seed for the fortunes of war</span>
                  <input value={seed} inputMode="numeric" onChange={(e) => setSeed(e.target.value.replace(/[^0-9]/g, '').slice(0, 9))} />
                </label>
                <label className="check">
                  <input type="checkbox" checked={!personas} onChange={(e) => setPersonas(!e.target.checked)} />
                  <span>
                    Without personas
                    <em>Strip every commander’s traits, to measure what the documents add.</em>
                  </span>
                </label>
                <button
                  type="button"
                  className="btn-ink"
                  onClick={() => {
                    setMenu(false);
                    void post('reset', { seed: seed ? Number(seed) : undefined, personas });
                  }}
                >
                  Reset the field
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <span className={`link ${connected ? 'is-up' : 'is-down'}`} title={connected ? `Connected to headquarters · ${state.clients ?? 1} at the table` : 'Reconnecting to headquarters'}>
          <i />
          {connected ? `${state.clients ?? 1} at the table` : 'reconnecting'}
        </span>
      </div>
    </header>
  );
}

export const Controls = memo(ControlsImpl);
