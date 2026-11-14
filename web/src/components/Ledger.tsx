import { memo } from 'react';
import type { GameState } from '../../../shared/types';
import { fmtInt, fmtUsd } from '../geo';

function ratio(a: number, b: number): string | null {
  if (!(a > 0) || !(b > 0)) return null;
  const r = a / b;
  if (r >= 100) return fmtInt(r) + '×';
  if (r >= 10) return r.toFixed(0) + '×';
  return r.toFixed(1) + '×';
}

function LedgerImpl({ ledger, mode, model }: Pick<GameState, 'ledger' | 'mode' | 'model'>) {
  const l = ledger ?? { decisions: 0, medianMs: 0, inputTokens: 0, costUsd: 0, frontierCostUsd: 0, frontierSeconds: 0 };
  const drexSeconds = (l.decisions * l.medianMs) / 1000;
  const cheaper = ratio(l.frontierCostUsd, l.costUsd);
  const faster = ratio(l.frontierSeconds, drexSeconds);
  const live = mode === 'drex';
  return (
    <section className="ledger" aria-label="Decision ledger">
      <header>
        <h2>Decision ledger</h2>
        <span className={`mode ${live ? 'mode-live' : 'mode-mock'}`} title={live ? 'Every decision is a live call to Drex' : 'Offline stand-in decider; no Drex calls are being made'}>
          {live ? 'Live Drex' : 'Mock decider'}
        </span>
      </header>
      {!live && <p className="ledger-model is-mock">Offline: figures are placeholders.</p>}
      <div className="ledger-big">
        <div><b>{fmtInt(l.decisions)}</b><span>decisions</span></div>
        <div><b>{l.medianMs > 0 ? `${Math.round(l.medianMs)} ms` : '—'}</b><span>each</span></div>
        <div><b>{fmtUsd(l.costUsd)}</b><span>paid to Drex</span></div>
        {cheaper && <div className="is-ratio"><b>{cheaper}</b><span>cheaper than a frontier LLM</span></div>}
      </div>
      <details className="ledger-more">
        <summary>Details{live && model ? ` · ${model}` : ''}</summary>
      <table>
        <tbody>
          <tr>
            <th scope="row">Decisions made</th>
            <td>{fmtInt(l.decisions)}</td>
          </tr>
          <tr>
            <th scope="row">Median time each</th>
            <td>{l.medianMs > 0 ? `${Math.round(l.medianMs)} ms` : '—'}</td>
          </tr>
          <tr>
            <th scope="row">Tokens read</th>
            <td>{fmtInt(l.inputTokens)}</td>
          </tr>
          <tr className="total">
            <th scope="row">Paid to Drex</th>
            <td>{fmtUsd(l.costUsd)}</td>
          </tr>
          <tr className="versus">
            <th scope="row">
              Same on a frontier LLM <em>est.</em>
            </th>
            <td>
              {fmtUsd(l.frontierCostUsd)}
              <small>{l.frontierSeconds > 0 ? `${fmtInt(l.frontierSeconds)} s` : ''}</small>
            </td>
          </tr>
          {l.measured && (
            <tr className="versus measured">
              <th scope="row">
                {l.measured.model} <em>measured, {fmtInt(l.measured.decisions)} decisions</em>
              </th>
              <td>
                {fmtUsd(l.measured.costUsd)}
                <small>{Math.round(l.measured.medianMs)} ms each</small>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </details>
      {false && (cheaper || faster) && (
        <p className="ledger-ratio">
          {cheaper && (
            <span>
              <b>{cheaper}</b> cheaper
            </span>
          )}
          {faster && (
            <span>
              <b>{faster}</b> faster
            </span>
          )}
        </p>
      )}
    </section>
  );
}

export const Ledger = memo(LedgerImpl);
