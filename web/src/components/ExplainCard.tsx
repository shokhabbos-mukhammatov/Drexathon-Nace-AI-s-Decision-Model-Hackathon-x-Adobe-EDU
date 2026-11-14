import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import type { Decision, ExplainResult } from '../../../shared/types';
import { clock12, pct } from '../geo';
import { ProbBars } from './ProbBars';

interface Props {
  decision: Decision;
  post: <T = unknown>(path: string, body?: unknown) => Promise<T | null>;
  onClose: () => void;
}

/** Which persona traits moved a decision: Drex is asked again with each trait removed. */
export function ExplainCard({ decision, post, onClose }: Props) {
  const [result, setResult] = useState<ExplainResult | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setResult(null);
    setFailed(false);
    post<ExplainResult>('explain', { decisionId: decision.id }).then((r) => {
      if (!live) return;
      if (r && Array.isArray(r.traits)) setResult(r);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [decision.id, post]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const traits = (result?.traits ?? []).slice().sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const span = Math.max(0.05, ...traits.map((t) => Math.abs(t.delta)));
  const chosenLabel = result?.chosenLabel ?? decision.options.find((o) => o.id === decision.chosen)?.label ?? decision.chosen;

  return (
    <div className="overlay" onClick={onClose}>
      <motion.section className="explain" onClick={(e) => e.stopPropagation()} initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.28 }} role="dialog" aria-label="Why this decision">
        <button type="button" className="close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <p className="kicker">
          Why this decision · {decision.agentName} · {clock12(decision.clock)}
        </p>
        <h2>{decision.question}</h2>
        <details className="explain-odds">
          <summary>All the odds</summary>
          <ProbBars options={decision.options} chosen={decision.chosen} historical={decision.historical} />
        </details>

        <h3>
          What moved the choice of “{chosenLabel}”
          {result && <span className="num"> {pct(result.pWith)}</span>}
        </h3>

        {!result && !failed && (
          <p className="explain-wait">
            <span className="quill" /> Asking Drex again with each trait struck out…
          </p>
        )}
        {failed && <p className="explain-wait">The explanation could not be drawn up. Try again in a moment.</p>}

        {result && traits.length === 0 && <p className="explain-wait">This commander has no traits on file in this run, so nothing can be struck out.</p>}

        {result && traits.length > 0 && (
          <>
            <div className="axis">
              <span>pulled away</span>
              <span>pushed toward</span>
            </div>
            <ul className="effects">
              {traits.map((t, i) => {
                const w = (Math.abs(t.delta) / span) * 50;
                const pos = t.delta >= 0;
                return (
                  <motion.li key={t.traitId} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}>
                    <div className="effect-row">
                      <span className="effect-label">{t.label}</span>
                      <span className="effect-track">
                        <motion.i
                          className={pos ? 'pos' : 'neg'}
                          style={pos ? { left: '50%' } : { right: '50%' }}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(0.8, w)}%` }}
                          transition={{ duration: 0.6, delay: 0.05 * i }}
                        />
                      </span>
                      <span className={`effect-num ${pos ? 'pos' : 'neg'}`}>
                        {pos ? '+' : '−'}
                        {(Math.abs(t.delta) * 100).toFixed(1)} pts
                      </span>
                    </div>
                    <p className="effect-note">
                      Without it: {pct(t.pWithout)}.
                      {t.citation && (
                        <span className="cite">
                          {' '}
                          {t.citation.quote && <q>{t.citation.quote}</q>}{' '}
                          {t.citation.url ? (
                            <a href={t.citation.url} target="_blank" rel="noreferrer">
                              {t.citation.doc}
                            </a>
                          ) : (
                            t.citation.doc
                          )}
                          {t.citation.page ? `, p. ${t.citation.page}` : ''}
                        </span>
                      )}
                    </p>
                  </motion.li>
                );
              })}
            </ul>
            <p className="explain-foot">
              {traits.length} re-asks, {Math.round(result.latencyMs)} ms in all. Each bar is the change in the chosen option’s probability when that one trait is removed.
            </p>
          </>
        )}
      </motion.section>
    </div>
  );
}
