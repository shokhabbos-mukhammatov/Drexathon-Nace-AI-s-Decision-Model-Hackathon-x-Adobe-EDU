import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { Commander, PendingChoice, TypedResult } from '../../../shared/types';
import { clock12, pct } from '../geo';
import { Portrait } from './CommanderPanel';
import { ProbBars } from './ProbBars';

interface Props {
  pending?: PendingChoice;
  /** How Drex read the last written order; kept by the parent so it outlives the pending choice. */
  reading: Reading | null;
  onReading: (r: Reading | null) => void;
  more: number;
  commander?: Commander;
  clientId: string;
  clock: string;
  post: <T = unknown>(path: string, body?: unknown) => Promise<T | null>;
}

export interface Reading {
  text: string;
  result: TypedResult;
  question: string;
}

/** A field order form: pick a legal order, or write one and let Drex read it. */
export function OrderSheet({ pending, reading, onReading, more, commander, clientId, clock, post }: Props) {
  const setReading = onReading;
  const pendingId = pending?.id;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText('');
    setError(null);
    setBusy(false);
  }, [pendingId]);

  const choose = async (optionId: string) => {
    if (busy || !pending) return;
    setBusy(true);
    setError(null);
    const r = await post('choose', { pendingId: pending.id, optionId, clientId });
    if (r === null) {
      setError('The order did not reach headquarters. Try again.');
      setBusy(false);
    }
  };

  const send = async () => {
    const t = text.trim();
    if (!t || busy || !pending) return;
    setBusy(true);
    setError(null);
    const question = pending.question;
    const r = await post<TypedResult>('typed', { pendingId: pending.id, text: t, clientId });
    setBusy(false);
    if (!r || !Array.isArray(r.options)) {
      setError('The order did not reach headquarters. Try again.');
      return;
    }
    if (r.ok === false) {
      setError(r.error ?? 'Drex could not read that as one of the lawful orders. Rephrase it or pick one above.');
      if (r.options.length) setReading({ text: t, result: r, question });
      return;
    }
    setReading({ text: t, result: r, question });
  };

  if (reading) {
    const chosen = reading.result.options.find((o) => o.id === reading.result.chosen);
    return (
      <div className="sheet-wrap">
        <motion.section className="sheet sheet-reading" initial={{ y: 30, opacity: 0, rotate: -1.2 }} animate={{ y: 0, opacity: 1, rotate: -0.4 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }} aria-label="How Drex read your order">
          <p className="sheet-kicker">Your order, as read by Drex</p>
          <blockquote className="sheet-quote">{reading.text}</blockquote>
          {reading.result.ok !== false && chosen ? (
            <p className="sheet-verdict">
              Entered as <strong>{chosen.label}</strong> <span className="num">{pct(chosen.p)}</span>
            </p>
          ) : (
            <p className="sheet-verdict is-bad">Not entered. Drex could not match it to a lawful order.</p>
          )}
          <ProbBars options={reading.result.options} chosen={reading.result.chosen} />
          <div className="sheet-actions">
            <button type="button" className="btn-ink" onClick={() => setReading(null)} autoFocus>
              {reading.result.ok === false ? 'Write it again' : 'Carry on'}
            </button>
          </div>
        </motion.section>
      </div>
    );
  }

  if (!pending) return null;

  return (
    <div className="sheet-wrap">
      <motion.section
        key={pending.id}
        className={`sheet side-${commander?.side ?? 'union'}`}
        initial={{ y: 40, opacity: 0, rotate: 1.4 }}
        animate={{ y: 0, opacity: 1, rotate: 0.3 }}
        transition={{ type: 'spring', stiffness: 240, damping: 24 }}
        aria-label="Field order form"
      >
        <header className="sheet-head">
          {commander && <Portrait commander={commander} size={54} />}
          <div>
            <p className="sheet-kicker">Field order · {clock12(clock)}</p>
            <h2>{commander ? `You command as ${commander.name}` : 'You command'}</h2>
            <p className="sheet-sub">
              {commander ? `${commander.rank} · ${commander.role}` : ''}
              {pending.unitName ? ` · for ${pending.unitName}` : ''}
              {more > 0 ? ` · ${more} more to follow` : ''}
            </p>
          </div>
        </header>

        <p className="sheet-question">{pending.question}</p>

        <ol className="sheet-options">
          {(pending.options ?? []).map((o, i) => (
            <li key={o.id}>
              <button type="button" className="option" disabled={busy} onClick={() => choose(o.id)}>
                <span className="option-n">{String.fromCharCode(65 + i)}</span>
                <span className="option-body">
                  <strong>{o.label}</strong>
                  {o.description && <em>{o.description}</em>}
                </span>
                <span className="option-real" title="What the real commander would likely do, according to Drex">
                  <i style={{ width: `${Math.max(2, (o.p ?? 0) * 100)}%` }} />
                  <b>{pct(o.p)}</b>
                </span>
              </button>
            </li>
          ))}
        </ol>
        <p className="sheet-note">The faint bars are Drex’s reading of what the real commander would likely do.</p>

        <div className="sheet-write">
          <label htmlFor="order-text">Write your order</label>
          <textarea
            id="order-text"
            ref={box}
            value={text}
            rows={2}
            placeholder="In your own words, for example: hold the ridge as ordered and send for the Fifth Corps."
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            disabled={busy}
          />
          <button type="button" className="btn-ink" disabled={busy || !text.trim()} onClick={() => void send()}>
            {busy ? 'Riding to headquarters…' : 'Send by courier'}
          </button>
        </div>
        {error && <p className="sheet-error">{error}</p>}
      </motion.section>
    </div>
  );
}
