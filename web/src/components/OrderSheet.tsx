import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { Commander, DecisionOption, PendingChoice, TypedResult } from '../../../shared/types';
import { clock12, pct } from '../geo';
import { Portrait } from './CommanderPanel';

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

const surname = (c?: Commander) => (c ? c.name.split(' ').pop() : 'the general');
const likeliest = (opts: DecisionOption[] = []) => [...opts].sort((a, b) => (b.p ?? 0) - (a.p ?? 0))[0]?.id;

/**
 * The order form. One clear question, the choices as large buttons, and a single quiet mark on
 * the choice the real commander would likely have made. Writing an order in your own words is
 * there, but folded away until asked for.
 */
export function OrderSheet({ pending, reading, onReading, more, batch, commander, clientId, clock, post }: Props) {
  const setReading = onReading;
  const pendingId = pending?.id;
  const [text, setText] = useState('');
  const [writing, setWriting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const group = batch && batch.length > 1 ? batch : null;
  const groupKey = group ? group.map((g) => g.id).join(',') : '';
  const [picks, setPicks] = useState<Record<string, string>>({});

  useEffect(() => {
    setText('');
    setError(null);
    setBusy(false);
    setWriting(false);
  }, [pendingId]);

  // A batch starts on what Drex thinks the real commander would have done.
  useEffect(() => {
    if (!group) return;
    const next: Record<string, string> = {};
    for (const g of group) next[g.id] = likeliest(g.options) ?? '';
    setPicks(next);
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKey]);

  useEffect(() => {
    if (writing) box.current?.focus();
  }, [writing]);

  const choose = async (optionId: string) => {
    if (busy || !pending) return;
    setBusy(true);
    setError(null);
    const r = await post('choose', { pendingId: pending.id, optionId, clientId });
    if (r === null) {
      setError('That order did not get through. Try again.');
      setBusy(false);
    }
  };

  const sendBatch = async () => {
    if (busy || !group) return;
    setBusy(true);
    setError(null);
    for (const g of group) {
      const r = await post('choose', { pendingId: g.id, optionId: picks[g.id] ?? g.options?.[0]?.id, clientId });
      if (r === null) {
        setError('An order did not get through. Try again.');
        setBusy(false);
        return;
      }
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
      setError('That order did not get through. Try again.');
      return;
    }
    if (r.ok === false) {
      setError(r.error ?? 'Drex could not match that to one of the choices. Rephrase it, or pick one above.');
      return;
    }
    setReading({ text: t, result: r, question });
  };

  // After a written order: say plainly what it was taken to mean, and move on.
  if (reading) {
    const chosen = reading.result.options.find((o) => o.id === reading.result.chosen);
    return (
      <div className="sheet-wrap">
        <motion.section className="sheet sheet-reading" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }} aria-label="How Drex read your order">
          <blockquote className="sheet-quote">{reading.text}</blockquote>
          <p className="sheet-verdict">
            Drex read this as <strong>{chosen?.label ?? 'one of the choices'}</strong> <span className="num">{chosen ? pct(chosen.p) : ''}</span>
          </p>
          <div className="sheet-actions">
            <button type="button" className="btn-ink" onClick={() => setReading(null)} autoFocus>
              Carry on
            </button>
          </div>
        </motion.section>
      </div>
    );
  }

  if (!pending) return null;

  const head = (
    <header className="sheet-head">
      {commander && <Portrait commander={commander} size={46} />}
      <div>
        <p className="sheet-kicker">{clock12(clock)} · your order</p>
        <h2>{commander ? `You are ${commander.name}` : 'You command'}</h2>
      </div>
      {more > 0 && !group && <span className="sheet-more">{more} more after this</span>}
    </header>
  );

  if (group) {
    return (
      <div className="sheet-wrap">
        <motion.section key={groupKey} className={`sheet sheet-batch side-${commander?.side ?? 'union'}`} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 240, damping: 24 }} aria-label="Orders for your units">
          {head}
          <p className="sheet-question">{group[0].kind === 'order' ? 'Orders for your brigades this half hour.' : 'Where should each of your reserves go?'}</p>
          <p className="sheet-hint">Each is set to what the real {surname(commander)} would likely do. Change any, then send.</p>
          <div className="batch">
            {group.map((g) => {
              const top = likeliest(g.options);
              return (
                <div key={g.id} className="batch-row">
                  <strong className="batch-unit">{g.unitName ?? 'Reserve'}</strong>
                  <div className="batch-options" role="radiogroup" aria-label={`Orders for ${g.unitName ?? 'this unit'}`}>
                    {(g.options ?? []).map((o) => (
                      <button key={o.id} type="button" role="radio" aria-checked={picks[g.id] === o.id} className={`chip ${picks[g.id] === o.id ? 'is-on' : ''} ${o.id === top ? 'is-likely' : ''}`} disabled={busy} title={o.description} onClick={() => setPicks((prev) => ({ ...prev, [g.id]: o.id }))}>
                        {o.label.replace(/^To /, '')}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="sheet-actions">
            <button type="button" className="btn-seal" disabled={busy} onClick={() => void sendBatch()} autoFocus>
              {busy ? 'Sending…' : 'Send orders'}
            </button>
          </div>
          {error && <p className="sheet-error">{error}</p>}
        </motion.section>
      </div>
    );
  }

  const top = likeliest(pending.options);
  return (
    <div className="sheet-wrap">
      <motion.section key={pending.id} className={`sheet side-${commander?.side ?? 'union'}`} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 240, damping: 24 }} aria-label="Your order">
        {head}
        <p className="sheet-question">{pending.question}</p>
        {pending.unitName && <p className="sheet-hint">For {pending.unitName}.</p>}

        <div className="sheet-options">
          {(pending.options ?? []).map((o) => (
            <button key={o.id} type="button" className={`option ${o.id === top ? 'is-likely' : ''}`} disabled={busy} onClick={() => choose(o.id)} title={o.description}>
              <strong>{o.label}</strong>
              {o.id === top && <span className="likely">likely in 1863 · {pct(o.p)}</span>}
            </button>
          ))}
        </div>

        {writing ? (
          <div className="sheet-write">
            <textarea
              ref={box}
              value={text}
              rows={2}
              placeholder="For example: hold the ridge as ordered"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              disabled={busy}
              aria-label="Your order in your own words"
            />
            <button type="button" className="btn-ink" disabled={busy || !text.trim()} onClick={() => void send()}>
              {busy ? 'Sending…' : 'Send'}
            </button>
          </div>
        ) : (
          <button type="button" className="sheet-write-open" onClick={() => setWriting(true)}>
            or write the order in your own words
          </button>
        )}
        {error && <p className="sheet-error">{error}</p>}
      </motion.section>
    </div>
  );
}
