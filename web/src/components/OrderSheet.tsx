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
  /** Every order of the same kind waiting on this commander, so a batch can be answered on one sheet. */
  batch?: PendingChoice[];
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
export function OrderSheet({ pending, reading, onReading, more, batch, commander, clientId, clock, post }: Props) {
  const setReading = onReading;
  const pendingId = pending?.id;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  // One sheet for a batch of like orders (Meade placing each of his reserves): pick for all, send once.
  const group = batch && batch.length > 1 ? batch : null;
  const groupKey = group ? group.map((g) => g.id).join(',') : '';
  const [picks, setPicks] = useState<Record<string, string>>({});

  useEffect(() => {
    setText('');
    setError(null);
    setBusy(false);
  }, [pendingId]);

  // Start each line of a batch on what Drex thinks the real commander would have done.
  useEffect(() => {
    if (!group) return;
    const next: Record<string, string> = {};
    for (const g of group) next[g.id] = [...(g.options ?? [])].sort((a, b) => (b.p ?? 0) - (a.p ?? 0))[0]?.id ?? '';
    setPicks(next);
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKey]);

  const sendBatch = async () => {
    if (busy || !group) return;
    setBusy(true);
    setError(null);
    for (const g of group) {
      const r = await post('choose', { pendingId: g.id, optionId: picks[g.id] ?? g.options?.[0]?.id, clientId });
      if (r === null) {
        setError('An order did not reach headquarters. Try again.');
        setBusy(false);
        return;
      }
    }
  };

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

  if (group) {
    const top = (g: PendingChoice) => [...(g.options ?? [])].sort((a, b) => (b.p ?? 0) - (a.p ?? 0))[0]?.id;
    const changed = group.filter((g) => picks[g.id] && picks[g.id] !== top(g)).length;
    return (
      <div className="sheet-wrap">
        <motion.section key={groupKey} className={`sheet sheet-batch side-${commander?.side ?? 'union'}`} initial={{ y: 40, opacity: 0, rotate: 1.4 }} animate={{ y: 0, opacity: 1, rotate: 0.3 }} transition={{ type: 'spring', stiffness: 240, damping: 24 }} aria-label="Orders for the reserves">
          <header className="sheet-head">
            {commander && <Portrait commander={commander} size={54} />}
            <div>
              <p className="sheet-kicker">Field order · {clock12(clock)}</p>
              <h2>{commander ? `You command as ${commander.name}` : 'You command'}</h2>
              <p className="sheet-sub">
                {commander ? `${commander.rank} · ${commander.role} · ` : ''}
                {group.length} bodies of troops await your word
              </p>
            </div>
          </header>
          <p className="sheet-question">Where does each go this half hour?</p>
          <div className="batch">
            {group.map((g) => {
              const about = /\((\d[^)]*)\)/.exec(g.question)?.[1]; // "1245 men, in reserve at Baltimore Pike"
              return (
                <div key={g.id} className="batch-row">
                  <div className="batch-unit">
                    <strong>{g.unitName ?? 'Reserve'}</strong>
                    {about && <em>{about}</em>}
                  </div>
                  <div className="batch-options" role="radiogroup" aria-label={`Orders for ${g.unitName ?? 'this unit'}`}>
                    {(g.options ?? []).map((o) => (
                      <button key={o.id} type="button" role="radio" aria-checked={picks[g.id] === o.id} className={`chip ${picks[g.id] === o.id ? 'is-on' : ''}`} disabled={busy} title={o.description} onClick={() => setPicks((prev) => ({ ...prev, [g.id]: o.id }))}>
                        {o.label.replace(/^To /, '')}
                        <small>{pct(o.p)}</small>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="sheet-note">Each line starts on what Drex reads as the real commander's likeliest choice; the small figure is its probability. Change any you like, then send them together.</p>
          <div className="sheet-actions">
            <button type="button" className="btn-ink" disabled={busy} onClick={() => void sendBatch()} autoFocus>
              {busy ? 'Riding to headquarters…' : changed ? `Send these orders (${changed} of your own)` : 'Send these orders'}
            </button>
          </div>
          {error && <p className="sheet-error">{error}</p>}
        </motion.section>
      </div>
    );
  }

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
