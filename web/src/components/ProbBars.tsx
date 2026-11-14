import type { DecisionOption } from '../../../shared/types';
import { pct } from '../geo';

interface Props {
  options: DecisionOption[];
  chosen?: string;
  historical?: string;
  /** Lighter treatment, for "what the real commander would likely do". */
  faint?: boolean;
  /** Cap on rows; the chosen and historical options are always kept. */
  max?: number;
}

/** Probabilities as hand-inked bars: the chosen option solid, the rest hatched. */
export function ProbBars({ options, chosen, historical, faint, max }: Props) {
  let rows = (options ?? []).slice();
  if (max && rows.length > max) {
    const keep = new Set<string>();
    if (chosen) keep.add(chosen);
    if (historical) keep.add(historical);
    const ranked = rows.slice().sort((a, b) => (b.p ?? 0) - (a.p ?? 0));
    for (const r of ranked) {
      if (keep.size >= max) break;
      keep.add(r.id);
    }
    rows = rows.filter((r) => keep.has(r.id));
  }
  if (rows.length === 0) return null;
  return (
    <ul className={`probs ${faint ? 'is-faint' : ''}`}>
      {rows.map((o) => {
        const isChosen = o.id === chosen;
        const isHist = o.id === historical;
        return (
          <li key={o.id} className={`prob ${isChosen ? 'is-chosen' : ''}`} title={o.description ?? o.label}>
            <span className="prob-label">
              {o.label}
              {isHist && <sup className="tick-1863">1863</sup>}
            </span>
            <span className="prob-track">
              <span className="prob-fill" style={{ width: `${Math.max(1.5, Math.min(100, (o.p ?? 0) * 100))}%` }} />
            </span>
            <span className="prob-num">{pct(o.p)}</span>
          </li>
        );
      })}
    </ul>
  );
}
