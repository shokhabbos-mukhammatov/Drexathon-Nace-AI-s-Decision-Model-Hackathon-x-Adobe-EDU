import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import type { GameState, Holder } from '../../../shared/types';
import { fmtInt } from '../geo';
import { Markdown } from './Markdown';
import { ProbBars } from './ProbBars';
import { CheckpointList } from './Timeline';

const WORD: Record<Holder, string> = { union: 'Union', confederate: 'Confederate', contested: 'Contested', empty: 'Unheld' };

function HolderTag({ h }: { h: Holder }) {
  return (
    <span className={`holder holder-${h}`}>
      <i />
      {WORD[h] ?? h}
    </span>
  );
}

interface Props {
  state: GameState;
  post: (path: string, body?: unknown) => Promise<unknown>;
  onClose: () => void;
}

/** The field at nightfall: what changed against the record, the council, and the debrief. */
export function EndPlate({ state, post, onClose }: Props) {
  const [tab, setTab] = useState<'field' | 'council' | 'report'>('field');
  const [asking, setAsking] = useState<'council' | 'report' | null>(null);
  const objectives = state.objectives ?? [];
  const same = objectives.filter((o) => o.holder === o.historical).length;
  const f = state.fidelity ?? { checkpoints: [], matched: 0, decided: 0 };
  const report = state.report ?? { status: 'idle' as const };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (state.council) setAsking((a) => (a === 'council' ? null : a));
    if (report.status !== 'idle') setAsking((a) => (a === 'report' ? null : a));
  }, [state.council, report.status]);

  const convene = async () => {
    setTab('council');
    if (state.council || asking === 'council') return;
    setAsking('council');
    await post('council', {});
    setAsking((a) => (a === 'council' ? null : a));
  };

  const writeReport = async () => {
    setTab('report');
    if (report.status === 'writing' || report.status === 'done' || asking === 'report') return;
    setAsking('report');
    await post('report', {});
  };

  return (
    <div className="overlay" onClick={onClose}>
      <motion.section className="plate" onClick={(e) => e.stopPropagation()} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.35 }} role="dialog" aria-label="The field at nightfall">
        <button type="button" className="close" onClick={onClose} aria-label="Close and look at the map">
          ×
        </button>
        <p className="kicker">
          {state.battle} · {state.date}
        </p>
        <h1>The field at nightfall</h1>
        {state.outcome && <p className="end-outcome">{state.outcome.text}</p>}
        {state.canFightOn && (
          <p className="end-fighton">
            History stops at dusk, but the field is not decided.{' '}
            <button type="button" className="btn-seal" onClick={() => { void post('continue', {}); onClose(); }}>
              Fight on until it is decided
            </button>
          </p>
        )}

        <nav className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'field'} className={tab === 'field' ? 'is-on' : ''} onClick={() => setTab('field')}>
            Against the record
          </button>
          <button type="button" role="tab" aria-selected={tab === 'council'} className={tab === 'council' ? 'is-on' : ''} onClick={convene}>
            Convene the council of war
          </button>
          <button type="button" role="tab" aria-selected={tab === 'report'} className={tab === 'report' ? 'is-on' : ''} onClick={writeReport}>
            After-action report
          </button>
        </nav>

        {tab === 'field' && (
          <div className="plate-body">
            <div className="figures">
              <div className="figure">
                <b>
                  {same}
                  <small> of {objectives.length}</small>
                </b>
                <span>key positions held as on the night of 1863</span>
              </div>
              <div className="figure">
                <b>
                  {f.matched}
                  <small> of {f.decided}</small>
                </b>
                <span>documented decisions repeated</span>
              </div>
              <div className="figure side-union">
                <b>{fmtInt(state.casualties?.union)}</b>
                <span>Union casualties</span>
              </div>
              <div className="figure side-confederate">
                <b>{fmtInt(state.casualties?.confederate)}</b>
                <span>Confederate casualties</span>
              </div>
            </div>

            {(f.withPersona || f.withoutPersona) && (
              <p className="fid-compare">
                History fidelity on autopilot:
                {f.withPersona && (
                  <span>
                    <b>
                      {f.withPersona.matched} of {f.withPersona.total}
                    </b>{' '}
                    with the documents’ personas
                  </span>
                )}
                {f.withoutPersona && (
                  <span>
                    <b>
                      {f.withoutPersona.matched} of {f.withoutPersona.total}
                    </b>{' '}
                    without them
                  </span>
                )}
              </p>
            )}

            <div className="cols">
              <section>
                <h2>The ground</h2>
                <table className="ground">
                  <thead>
                    <tr>
                      <th>Position</th>
                      <th>This evening</th>
                      <th>In 1863</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {objectives.map((o) => (
                      <tr key={o.nodeId} className={o.holder === o.historical ? '' : 'is-changed'}>
                        <th scope="row">{o.name}</th>
                        <td>
                          <HolderTag h={o.holder} />
                        </td>
                        <td>
                          <HolderTag h={o.historical} />
                        </td>
                        <td>{o.holder === o.historical ? <span className="same">as recorded</span> : <span className="stamp stamp-diverged">Changed</span>}</td>
                      </tr>
                    ))}
                    {objectives.length === 0 && (
                      <tr>
                        <td colSpan={4}>No positions are tracked for this battle.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
              <section>
                <h2>The decisions</h2>
                <CheckpointList state={state} />
              </section>
            </div>
          </div>
        )}

        {tab === 'council' && (
          <div className="plate-body">
            {!state.council && (
              <p className="plate-wait">
                <span className="quill" /> The generals are called to headquarters. Each is asked in turn.
              </p>
            )}
            {state.council && (
              <>
                <p className="council-result">{state.council.result}</p>
                <ul className="votes">
                  {(state.council.votes ?? []).map((v, i) => (
                    <motion.li key={v.name + i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * i }}>
                      <header>
                        <strong>{v.name}</strong>
                        <span>{v.role}</span>
                      </header>
                      <ProbBars options={v.options} chosen={v.chosen} historical={v.historical} />
                    </motion.li>
                  ))}
                </ul>
                <p className="plate-note">A small “1863” marks how each general is recorded as having voted that night.</p>
              </>
            )}
          </div>
        )}

        {tab === 'report' && (
          <div className="plate-body">
            {(report.status === 'idle' || report.status === 'writing') && (
              <p className="plate-wait">
                <span className="quill" /> {report.status === 'writing' ? 'The report is being written from the decision log.' : 'Sending for the report.'}
                {report.note ? ` ${report.note}` : ''}
              </p>
            )}
            {report.status === 'error' && (
              <p className="plate-wait">
                The report could not be written. {report.note ?? ''}{' '}
                <button type="button" className="btn-ghost" onClick={() => post('report', {})}>
                  Try again
                </button>
              </p>
            )}
            {report.status === 'done' && (
              <article className="report">
                <p className="report-by">
                  {report.by === 'intern' ? 'Written by Intern, the Nace agent, from this run’s decision log' : 'Assembled from a template from this run’s decision log'}
                  {report.note ? ` · ${report.note}` : ''}
                </p>
                <Markdown source={report.markdown ?? ''} />
              </article>
            )}
          </div>
        )}
      </motion.section>
    </div>
  );
}
