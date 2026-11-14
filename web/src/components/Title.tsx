import { motion } from 'motion/react';
import type { GameState } from '../../../shared/types';
import { useImageOk } from '../useGame';

interface Props {
  state: GameState | null;
  connected: boolean;
  onOpen: () => void;
  onHow?: () => void;
}

export function Title({ state, connected, onOpen, onHow }: Props) {
  const backdrop = useImageOk('/title.jpg');
  const ready = !!state;
  return (
    <motion.div className={`title ${backdrop ? 'has-backdrop' : ''}`} style={backdrop ? { backgroundImage: 'url(/title.jpg)' } : undefined} initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.03 }} transition={{ duration: 0.7 }}>
      <div className="title-veil" />
      <motion.div className="title-plate" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.15 }}>
        <svg className="title-orn" viewBox="0 0 320 24" aria-hidden="true">
          <path d="M0 12h120M200 12h120" stroke="currentColor" strokeWidth="1" />
          <path d="M160 2l10 10l-10 10l-10 -10z" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path d="M160 7l5 5l-5 5l-5 -5z" fill="currentColor" />
          <circle cx="128" cy="12" r="2.4" fill="currentColor" />
          <circle cx="192" cy="12" r="2.4" fill="currentColor" />
        </svg>
        <p className="title-over">The muse of history</p>
        <h1>
          {'CLIO'.split('').map((ch, i) => (
            <motion.span key={i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.35 + i * 0.12 }}>
              {ch}
            </motion.span>
          ))}
        </h1>
        <p className="title-line">Stand where they stood.</p>
        <p className="title-battle">
          {state ? (
            <>
              {state.battle}
              <i>{state.date}</i>
            </>
          ) : (
            <>&nbsp;</>
          )}
        </p>
        <p className="title-what">
          A staff ride at software speed. Every commander on this field is an agent built from that commander’s own letters and reports, and every decision each one makes is made by Drex. Leave them alone and the afternoon runs as it was recorded; take a command and see what your order would have changed.
        </p>
        <button type="button" className="btn-seal btn-big" onClick={onOpen} disabled={!ready} autoFocus>
          {ready ? 'Open the map' : connected ? 'Unrolling the map…' : 'Riding to headquarters…'}
        </button>
        {onHow && (
          <button type="button" className="title-how" onClick={onHow}>
            How it works
          </button>
        )}
        <p className={`title-link ${connected && ready ? 'is-up' : ''}`}>
          <i />
          {ready ? (state?.mode === 'drex' ? `Live on Drex${state.model ? ' · ' + state.model : ''}` : 'Offline rehearsal: the mock decider is standing in for Drex') : 'Connecting to the battle server'}
        </p>
      </motion.div>
    </motion.div>
  );
}
