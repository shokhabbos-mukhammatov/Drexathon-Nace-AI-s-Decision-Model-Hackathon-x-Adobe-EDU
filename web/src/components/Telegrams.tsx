import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { BattleEvent, Decision } from '../../../shared/types';
import { clock12 } from '../geo';

interface Item {
  key: string;
  turn: number;
  order: number;
  clock: string;
  kind: 'dispatch' | BattleEvent['kind'];
  from?: string;
  side?: string;
  text: string;
  decisionId?: string;
  human?: boolean;
}

function TypeOn({ text, live }: { text: string; live: boolean }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(live && !reduce ? 0 : text.length);
  useEffect(() => {
    if (!live || reduce) {
      setN(text.length);
      return;
    }
    setN(0);
    const step = Math.max(1, Math.ceil(text.length / 90));
    const t = setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          clearInterval(t);
          return v;
        }
        return Math.min(text.length, v + step);
      });
    }, 22);
    return () => clearInterval(t);
  }, [text, live, reduce]);
  return (
    <>
      {text.slice(0, n)}
      {n < text.length && <span className="caret" />}
      {n < text.length && <span className="ghost">{text.slice(n)}</span>}
    </>
  );
}

const EVENT_WORD: Record<BattleEvent['kind'], string> = {
  clash: 'Engagement',
  rout: 'Line broken',
  charge: 'Charge',
  arrival: 'Arrival',
  capture: 'Ground taken',
  courier: 'Courier',
  wounded: 'Officer down',
  note: 'Field note',
};

interface Props {
  decisions: Decision[];
  events: BattleEvent[];
  onExplain: (decisionId: string) => void;
}

function TelegramsImpl({ decisions, events, onExplain }: Props) {
  const items = useMemo(() => {
    const out: Item[] = [];
    (decisions ?? []).forEach((d, i) => {
      if (!d.dispatch) return;
      out.push({ key: 'd-' + d.id, turn: d.turn, order: i, clock: d.clock, kind: 'dispatch', from: d.agentName, side: d.side, text: d.dispatch, decisionId: d.explainable ? d.id : undefined, human: d.by === 'human' });
    });
    (events ?? []).forEach((e, i) => {
      out.push({ key: 'e-' + e.id, turn: e.turn, order: 100000 + i, clock: e.clock, kind: e.kind, side: e.side, text: e.text });
    });
    out.sort((a, b) => b.turn - a.turn || b.order - a.order);
    return out.slice(0, 16);
  }, [decisions, events]);

  // Anything on the wire before the page opened is shown already typed.
  const seen = useRef<Set<string> | null>(null);
  if (seen.current === null) seen.current = new Set(items.map((i) => i.key));
  const fresh = (key: string) => !seen.current!.has(key);
  const queued = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const it of items) {
      if (seen.current!.has(it.key) || queued.current.has(it.key)) continue;
      queued.current.add(it.key);
      setTimeout(() => seen.current?.add(it.key), 3200);
    }
  }, [items]);

  return (
    <section className="wire" aria-label="Dispatches and field notes">
      <h2 className="wire-title">
        <span>Field telegraph</span>
      </h2>
      <div className="wire-strip">
        {items.length === 0 && <p className="wire-empty">The wire is quiet. Dispatches appear here as the commanders decide.</p>}
        <AnimatePresence initial={false}>
          {items.map((it, i) => {
            const isDispatch = it.kind === 'dispatch';
            return (
              <motion.article
                layout="position"
                key={it.key}
                className={`${isDispatch ? 'telegram' : 'bulletin bulletin-' + it.kind} side-${it.side ?? 'none'} ${it.decisionId ? 'is-clickable' : ''}`}
                style={{ opacity: Math.max(0.42, 1 - i * 0.07) }}
                initial={{ opacity: 0, y: 26, rotate: i % 2 ? 1.5 : -1.5 }}
                animate={{ opacity: Math.max(0.42, 1 - i * 0.07), y: 0, rotate: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                onClick={it.decisionId ? () => onExplain(it.decisionId!) : undefined}
                title={it.decisionId ? 'See which traits moved this decision' : undefined}
              >
                <header>
                  <span className="tg-from">{isDispatch ? it.from : EVENT_WORD[it.kind as BattleEvent['kind']] ?? 'Field note'}</span>
                  <time>{clock12(it.clock)}</time>
                </header>
                <p>{isDispatch ? <TypeOn text={it.text} live={fresh(it.key)} /> : it.text}</p>
                {isDispatch && it.human && <span className="tg-hand">in your hand</span>}
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}

export const Telegrams = memo(TelegramsImpl);
