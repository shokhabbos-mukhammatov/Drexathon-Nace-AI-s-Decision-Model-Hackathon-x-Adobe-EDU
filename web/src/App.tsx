import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig } from 'motion/react';
import type { Commander, Decision, Tier } from '../../shared/types';
import { useGame } from './useGame';
import { CommanderPanel } from './components/CommanderPanel';
import { Controls } from './components/Controls';
import { EndPlate } from './components/EndPlate';
import { ExplainCard } from './components/ExplainCard';
import { HowItWorks } from './components/HowItWorks';
import { Ledger } from './components/Ledger';
import { MapView } from './components/Map';
import { OrderSheet, type Reading } from './components/OrderSheet';
import { Telegrams } from './components/Telegrams';
import { Timeline } from './components/Timeline';
import { Title } from './components/Title';

const TIER_RANK: Record<Tier, number> = { army: 0, corps: 1, brigade: 2 };

export default function App() {
  const { state, clientId, connected, post } = useGame();
  const [showTitle, setShowTitle] = useState(true);
  const [showEnd, setShowEnd] = useState(false);
  // The explanatory page has its own address, #how-it-works, so it can be linked to.
  const [showHow, setShowHow] = useState(() => window.location.hash === '#how-it-works');
  const [explain, setExplain] = useState<Decision | null>(null);
  const [reading, setReading] = useState<Reading | null>(null);

  const commanders = state?.commanders ?? [];
  const decisions = state?.decisions ?? [];
  const units = state?.units ?? [];

  // The newest decision of each commander, counting those made at the head of their own unit.
  const latest = useMemo(() => {
    const ids = new Set(commanders.map((c) => c.id));
    const viaUnit = new Map<string, string>();
    for (const u of units) if (u.agentId) viaUnit.set(u.id, u.agentId);
    const out = new Map<string, Decision>();
    for (let i = decisions.length - 1; i >= 0; i--) {
      const d = decisions[i];
      const who = ids.has(d.agentId) ? d.agentId : viaUnit.get(d.agentId) ?? (d.unitId ? viaUnit.get(d.unitId) : undefined);
      // Prefer a command decision over routine brigade orders, which would otherwise crowd it out.
      if (!who) continue;
      const routine = d.kind === 'order' || (d.kind === 'reinforcement' && !!d.unitId) || d.kind === 'typed_order';
      const cur = out.get(who);
      if (!cur) out.set(who, d);
      else if (!routine && (cur.kind === 'order' || cur.kind === 'typed_order' || (cur.kind === 'reinforcement' && !!cur.unitId))) out.set(who, d);
    }
    return out;
  }, [commanders, decisions, units]);

  const sorted = useCallback(
    (side: Commander['side']) => commanders.filter((c) => c.side === side).sort((a, b) => (TIER_RANK[a.tier] ?? 9) - (TIER_RANK[b.tier] ?? 9)),
    [commanders],
  );
  const csa = useMemo(() => sorted('confederate'), [sorted]);
  const union = useMemo(() => sorted('union'), [sorted]);

  const mine = useMemo(() => new Set(commanders.filter((c) => c.controlledBy && c.controlledBy === clientId).map((c) => c.id)), [commanders, clientId]);
  const myPending = useMemo(() => (state?.pending ?? []).filter((p) => mine.has(p.commanderId)), [state?.pending, mine]);
  const waitingOn = useMemo(() => new Set((state?.pending ?? []).map((p) => p.commanderId)), [state?.pending]);

  // Open the nightfall plate once, when the battle ends.
  const phase = state?.phase;
  const runId = state?.runId;
  const endedFor = useRef<string | null>(null);
  useEffect(() => {
    if (phase === 'ended' && runId && endedFor.current !== runId) {
      endedFor.current = runId;
      const t = setTimeout(() => setShowEnd(true), 1600);
      return () => clearTimeout(t);
    }
    if (phase !== 'ended') {
      setShowEnd(false);
      if (endedFor.current && endedFor.current !== runId) endedFor.current = null;
    }
  }, [phase, runId]);

  const onExplain = useCallback(
    (id: string) => {
      const d = decisions.find((x) => x.id === id);
      if (d) setExplain(d);
    },
    [decisions],
  );
  const closeExplain = useCallback(() => setExplain(null), []);
  const closeEnd = useCallback(() => setShowEnd(false), []);
  const openEnd = useCallback(() => setShowEnd(true), []);
  const openTitle = useCallback(() => setShowTitle(true), []);
  useEffect(() => {
    const onHash = () => setShowHow(window.location.hash === '#how-it-works');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const openHow = useCallback(() => { setShowHow(true); window.history.replaceState(null, '', '#how-it-works'); }, []);
  const closeHow = useCallback(() => { setShowHow(false); window.history.replaceState(null, '', window.location.pathname + window.location.search); }, []);

  const head = myPending[0];
  const headCommander = head ? commanders.find((c) => c.id === head.commanderId) : undefined;
  // Like orders for one commander's separate units (Meade's reserves) are answered together on one sheet.
  const batch = useMemo(
    () => (head && (head.kind === 'reinforcement' || head.kind === 'order') && head.unitId ? myPending.filter((p) => p.commanderId === head.commanderId && p.kind === head.kind && !!p.unitId) : []),
    [head, myPending],
  );

  return (
    <MotionConfig reducedMotion="user">
      {state && (
        <div className={`app phase-${state.phase} mode-${state.mode}`}>
          <Controls state={state} connected={connected} awaitingMe={myPending.length > 0} post={post} onShowEnd={openEnd} onShowTitle={openTitle} onShowHow={openHow} />

          <aside className="col col-csa" aria-label="Confederate commanders">
            <h2 className="col-title">
              <span>Army of Northern Virginia</span>
            </h2>
            <div className="col-scroll">
              {csa.map((c) => (
                <CommanderPanel key={c.id} commander={c} latest={latest.get(c.id)} clientId={clientId} waiting={waitingOn.has(c.id)} post={post} onExplain={onExplain} />
              ))}
              {csa.length === 0 && <p className="col-empty">No commanders on this side.</p>}
            </div>
          </aside>

          <main className="stage">
            <p className={`stage-next ${myPending.length > 0 ? 'is-urgent' : ''}`} aria-live="polite">
              {myPending.length > 0
                ? 'Your order is waiting.'
                : state.phase === 'ended'
                  ? state.canFightOn
                    ? 'History stops at dusk, but nothing is decided. Press “Fight on”, or see the field at nightfall.'
                    : `${state.outcome?.text ?? 'The battle is over.'} See the field at nightfall.`
                  : state.extended && state.auto
                    ? 'After dark: fighting on until the field is decided.'
                  : state.turn === 0 && !state.auto && state.phase === 'ready'
                    ? 'Press “Let history run”, or first take command of a general.'
                    : state.auto
                      ? 'History is running. Take command of any general at any time.'
                      : state.phase === 'ready'
                        ? state.extended
                          ? 'Past dusk: let the battle run, or advance a turn, until the field is decided.'
                          : 'Advance a turn, or let history run.'
                        : 'The commanders are deciding…'}
            </p>
            <MapView state={state} />
          </main>

          <aside className="col col-union" aria-label="Union commanders">
            <h2 className="col-title">
              <span>Army of the Potomac</span>
            </h2>
            <div className="col-scroll">
              {union.map((c) => (
                <CommanderPanel key={c.id} commander={c} latest={latest.get(c.id)} clientId={clientId} waiting={waitingOn.has(c.id)} post={post} onExplain={onExplain} />
              ))}
              {union.length === 0 && <p className="col-empty">No commanders on this side.</p>}
            </div>
          </aside>

          <footer className="foot">
            <Timeline state={state} />
            <Telegrams decisions={decisions} events={state.events ?? []} onExplain={onExplain} />
            {/* The ledger sits in the footer so the whole height of each side column is the commanders'. */}
            <Ledger ledger={state.ledger} mode={state.mode} model={state.model} />
          </footer>

          {(head || reading) && !showTitle && (
            <OrderSheet pending={head} reading={reading} onReading={setReading} more={Math.max(0, myPending.length - 1)} batch={batch} commander={headCommander} clientId={clientId} clock={state.clock} post={post} />
          )}
          {explain && <ExplainCard decision={explain} post={post} onClose={closeExplain} />}
          {showEnd && state.phase === 'ended' && !explain && <EndPlate state={state} post={post} onClose={closeEnd} />}
        </div>
      )}
      <AnimatePresence>{(showTitle || !state) && !showHow && <Title key="title" state={state} connected={connected} onOpen={() => setShowTitle(false)} onHow={openHow} />}</AnimatePresence>
      {showHow && <HowItWorks onClose={closeHow} />}
    </MotionConfig>
  );
}
