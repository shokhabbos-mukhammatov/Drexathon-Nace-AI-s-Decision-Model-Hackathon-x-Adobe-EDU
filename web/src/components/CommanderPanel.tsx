import { memo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Commander, Compliance, Decision } from '../../../shared/types';
import { clock12 } from '../geo';
import { ProbBars } from './ProbBars';

const STAMP: Record<Compliance, string> = {
  obey: 'Obeys',
  delay: 'Delays',
  protest: 'Protests',
  deviate: 'Deviates',
};

function initials(name: string): string {
  const parts = (name ?? '').replace(/[^A-Za-z .'-]/g, '').split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  const last = parts[parts.length - 1];
  return (parts.length > 1 ? parts[0][0] : '') + last[0];
}

export function Portrait({ commander, size = 62 }: { commander: Commander; size?: number }) {
  const [failed, setFailed] = useState(false);
  const showImg = !!commander.portrait && !failed;
  return (
    <span className={`portrait side-${commander.side}`} style={{ width: size, height: size * 1.24 }}>
      {showImg ? (
        <img src={commander.portrait} alt={`Portrait of ${commander.name}`} onError={() => setFailed(true)} draggable={false} />
      ) : (
        <svg viewBox="0 0 100 124" aria-label={`Monogram of ${commander.name}`} role="img">
          <defs>
            <pattern id={`hatch-${commander.id}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
              <path d="M0 2h4" stroke="#2b2118" strokeWidth="0.55" opacity="0.5" />
            </pattern>
          </defs>
          <rect width="100" height="124" fill="#e2d1a4" />
          <rect width="100" height="124" fill={`url(#hatch-${commander.id})`} />
          <ellipse cx="50" cy="62" rx="33" ry="43" fill="#eadbb3" stroke="#2b2118" strokeWidth="1" />
          <ellipse cx="50" cy="62" rx="29" ry="39" fill="none" stroke="#2b2118" strokeWidth="0.5" strokeDasharray="1 2.4" />
          <text x="50" y="74" textAnchor="middle" fontSize="34" className="monogram">
            {initials(commander.name)}
          </text>
          <path d="M34 92q16 9 32 0" fill="none" stroke="#2b2118" strokeWidth="0.8" />
        </svg>
      )}
    </span>
  );
}

function PersonaBadge({ source }: { source: Commander['personaSource'] }) {
  if (source === 'ndi')
    return (
      <span className="badge badge-ndi" title="Persona extracted from primary sources by Nace Document Intelligence; every trait cites its page">
        <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">
          <path d="M10 1l2 2.2l2.9 -.6l.6 2.9l2.7 1.2l-1.2 2.7l1.2 2.7l-2.7 1.2l-.6 2.9l-2.9 -.6l-2 2.2l-2 -2.2l-2.9 .6l-.6 -2.9l-2.7 -1.2l1.2 -2.7l-1.2 -2.7l2.7 -1.2l.6 -2.9l2.9 .6z" fill="#9c2f25" />
          <path d="M6.4 10.2l2.4 2.4l4.8 -5" fill="none" stroke="#f1e6c8" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        NDI persona
      </span>
    );
  if (source === 'authored') return <span className="badge badge-authored" title="Built-in persona written from the sources, not extracted">Authored persona</span>;
  return <span className="badge badge-none" title="Traits stripped for the comparison run">No persona</span>;
}

interface Props {
  commander: Commander;
  latest?: Decision;
  clientId: string;
  waiting: boolean;
  post: (path: string, body?: unknown) => Promise<unknown>;
  onExplain: (decisionId: string) => void;
}

function CommanderPanelImpl({ commander, latest, clientId, waiting, post, onExplain }: Props) {
  const [open, setOpen] = useState(false);
  const mine = !!commander.controlledBy && commander.controlledBy === clientId;
  const taken = !!commander.controlledBy && !mine;
  const so = commander.standingOrder;

  return (
    <article className={`cmd side-${commander.side} ${mine ? 'is-mine' : ''} ${commander.status === 'wounded' ? 'is-wounded' : ''}`}>
      <header className="cmd-head">
        <Portrait commander={commander} />
        <div className="cmd-id">
          <h3>{commander.name}</h3>
          <p className="cmd-role">
            {commander.rank}
            {commander.rank && commander.role ? ' · ' : ''}
            {commander.role}
          </p>
          <div className="cmd-badges">
            <PersonaBadge source={commander.personaSource} />
            {commander.status === 'wounded' && <span className="badge badge-wounded">Wounded</span>}
          </div>
        </div>
        <AnimatePresence mode="wait">
          {commander.compliance && (
            <motion.span
              key={commander.compliance}
              className={`stamp stamp-${commander.compliance}`}
              initial={{ scale: 1.9, opacity: 0, rotate: -18 }}
              animate={{ scale: 1, opacity: 0.92, rotate: -9 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 22 }}
            >
              {STAMP[commander.compliance]}
            </motion.span>
          )}
        </AnimatePresence>
      </header>

      {so ? (
        <p className="cmd-order" title={so.text}>
          <span className="lbl">Order from {so.fromName}</span>
          {so.text}
        </p>
      ) : commander.intent ? (
        <p className="cmd-order">
          <span className="lbl">Intent</span>
          {commander.intent}
        </p>
      ) : null}

      {latest ? (
        <div
          className={`cmd-decision ${latest.explainable ? 'is-explainable' : ''}`}
          onClick={latest.explainable ? () => onExplain(latest.id) : undefined}
          role={latest.explainable ? 'button' : undefined}
          tabIndex={latest.explainable ? 0 : undefined}
          onKeyDown={latest.explainable ? (e) => (e.key === 'Enter' || e.key === ' ') && onExplain(latest.id) : undefined}
          title={latest.explainable ? 'See which traits moved this decision' : undefined}
        >
          <p className="q">
            <span className="q-clock">{clock12(latest.clock)}</span>
            {latest.question}
          </p>
          <ProbBars options={latest.options} chosen={latest.chosen} historical={latest.historical} max={4} />
          <p className="cmd-foot">
            <span className={`by by-${latest.by}`}>{latest.by === 'human' ? 'Decided by you' : latest.by === 'drex' ? 'Drex' : 'Mock decider'}</span>
            {latest.by !== 'human' && latest.latencyMs > 0 && <span className="ms">{Math.round(latest.latencyMs)} ms</span>}
            {latest.matchesHistory === true && <span className="mark mark-match">as in 1863</span>}
            {latest.matchesHistory === false && <span className="mark mark-diverge">diverges</span>}
            {latest.explainable && <span className="why">why?</span>}
          </p>
        </div>
      ) : (
        <p className="cmd-idle">Awaiting the first decision.</p>
      )}

      <footer className="cmd-actions">
        <button type="button" className="btn-ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? 'Hide traits' : `Traits (${commander.traits?.length ?? 0})`}
        </button>
        {mine ? (
          <button type="button" className="btn-ink is-active" onClick={() => post('release', { commanderId: commander.id, clientId })}>
            {waiting ? 'Your order is awaited' : 'Return to Drex'}
          </button>
        ) : (
          <button type="button" className="btn-ink" disabled={taken} onClick={() => post('claim', { commanderId: commander.id, clientId })} title={taken ? 'Another staff officer holds this command' : 'Decide in this commander’s place'}>
            {taken ? 'Held by another' : 'Take command'}
          </button>
        )}
      </footer>

      <AnimatePresence initial={false}>
        {open && (
          <motion.ul className="traits" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28 }}>
            {(commander.traits ?? []).length === 0 && <li className="trait">No traits on file for this run.</li>}
            {(commander.traits ?? []).map((t) => (
              <li key={t.id} className="trait">
                <strong>{t.label}.</strong> {t.text}
                {t.citation && (
                  <span className="cite">
                    {t.citation.quote && <q>{t.citation.quote}</q>}{' '}
                    {t.citation.url ? (
                      <a href={t.citation.url} target="_blank" rel="noreferrer">
                        {t.citation.doc}
                      </a>
                    ) : (
                      t.citation.doc
                    )}
                    {t.citation.page ? `, p. ${t.citation.page}` : ''}
                    {t.citation.status && t.citation.status !== 'found' ? ` (${t.citation.status.replace('_', ' ')})` : ''}
                  </span>
                )}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </article>
  );
}

export const CommanderPanel = memo(CommanderPanelImpl);
