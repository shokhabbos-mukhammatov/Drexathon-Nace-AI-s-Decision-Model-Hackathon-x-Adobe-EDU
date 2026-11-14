import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Commander, GameState, Holder, MapNode, Unit } from '../../../shared/types';
import { MAP_H, MAP_W, byId, clock12, computeSlots, fmtInt, pointAt, roadCurve } from '../geo';
import { useImageOk, useStable } from '../useGame';
import { BattleCard } from './BattleCard';
import { CourierLayer } from './CourierLayer';
import { MapBase, pickCorners } from './MapBase';
import { TroopCanvas } from './TroopCanvas';
import { UnitLayer } from './UnitLayer';
import { MAX_ZOOM, project, useMapView, viewBox } from '../useMapView';

const HOLDER_FILL: Record<Holder, string> = {
  union: '#2f4b7c',
  confederate: '#8a3a30',
  contested: 'url(#clio-contested)',
  empty: '#eadbb3',
};

const HOLDER_WORD: Record<Holder, string> = {
  union: 'Union',
  confederate: 'Confederate',
  contested: 'Contested',
  empty: 'Unheld',
};

function Flag({ node, holder, historical }: { node: MapNode; holder: Holder; historical?: Holder }) {
  const x = node.x;
  const y = node.y - 8;
  return (
    <g className="objective-flag">
      <title>{`${node.name}: ${HOLDER_WORD[holder] ?? holder} now; ${historical ? (HOLDER_WORD[historical] ?? historical) : 'unknown'} at nightfall in 1863`}</title>
      {historical && (
        <path d={`M${x} ${y - 30}l-17 5.5l17 5.5`} fill="none" stroke={historical === 'union' ? '#2f4b7c' : historical === 'confederate' ? '#8a3a30' : '#5a4a3a'} strokeWidth={1.1} strokeDasharray="2.5 2" opacity={0.85} />
      )}
      <path d={`M${x} ${y}v-32`} stroke="#2b2118" strokeWidth={1.4} strokeLinecap="round" />
      <motion.path
        key={holder}
        initial={{ scaleX: 0.2, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        style={{ transformOrigin: `${x}px ${y - 25}px`, transformBox: 'view-box' as const }}
        d={`M${x} ${y - 31}l19 4q-4 2 0 4.5l-19 3z`}
        fill={HOLDER_FILL[holder] ?? '#eadbb3'}
        stroke="#2b2118"
        strokeWidth={0.9}
        strokeLinejoin="round"
      />
      <circle cx={x} cy={y - 33} r={1.7} fill="#a8843a" stroke="#2b2118" strokeWidth={0.5} />
    </g>
  );
}

function Clash({ node, open, onOpen }: { node: MapNode; open: boolean; onOpen: () => void }) {
  return (
    <g
      className={`clash ${open ? 'is-open' : ''}`}
      transform={`translate(${node.x} ${node.y})`}
      role="button"
      tabIndex={0}
      aria-label={`See both sides of the fight for ${node.name}`}
      style={{ cursor: 'pointer' }}
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
    >
      <title>{`The fight for ${node.name}: see both sides`}</title>
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} className="drift" r={15 + i * 3} cx={(i - 1.5) * 9} cy={-4} fill="#f6f1e4" opacity={0.5} style={{ animationDelay: `${i * 0.7}s` }} />
      ))}
      <circle r={26} fill="transparent" />
      <g className="sabres" transform="scale(1.5)">
        <circle r={12} fill={open ? '#f3e6bd' : '#eadbb3'} stroke="#9c2f25" strokeWidth={open ? 2.2 : 1.3} />
        <path d="M-7 7L6 -7M-6.2 4.2l2.6 2.6" stroke="#2b2118" strokeWidth={1.6} strokeLinecap="round" />
        <path d="M7 7L-6 -7M6.2 4.2l-2.6 2.6" stroke="#2b2118" strokeWidth={1.6} strokeLinecap="round" />
      </g>
    </g>
  );
}

function Meter({ label, value, tone }: { label: string; value: number; tone?: 'warn' }) {
  const v = Math.max(0, Math.min(100, Math.round(value ?? 0)));
  return (
    <div className="uc-meter">
      <span>{label}</span>
      <i>
        <b style={{ width: v + '%', background: tone === 'warn' && v > 60 ? '#9c2f25' : undefined }} />
      </i>
      <em>{v}</em>
    </div>
  );
}

function UnitCard({ unit, commander, x, y }: { unit: Unit; commander?: Commander; x: number; y: number }) {
  const left = (x / MAP_W) * 100;
  const top = (y / MAP_H) * 100;
  const flipX = left > 72;
  const flipY = top > 66;
  return (
    <motion.div
      className={`unit-card side-${unit.side}`}
      style={{
        left: flipX ? undefined : `calc(${left}% + 26px)`,
        right: flipX ? `calc(${100 - left}% + 26px)` : undefined,
        top: flipY ? undefined : `calc(${top}% + 8px)`,
        bottom: flipY ? `calc(${100 - top}% + 8px)` : undefined,
      }}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
    >
      <div className="uc-head">
        <strong>{unit.name}</strong>
        <span className="uc-status">{(unit.inReserve ? 'reserve' : unit.status) ?? ''}</span>
      </div>
      <div className="uc-leader">{unit.leader}</div>
      <div className="uc-strength">
        <b>{fmtInt(unit.strength)}</b> of {fmtInt(unit.strength0)} men
      </div>
      <Meter label="Morale" value={unit.morale} />
      <Meter label="Fatigue" value={unit.fatigue} tone="warn" />
      <Meter label="Ammunition" value={unit.ammo} />
      <div className="uc-order">
        <span>Order</span> {unit.order?.label ?? 'None yet'}
      </div>
      {unit.moving && (
        <div className="uc-order">
          <span>On the march</span> {Math.round(unit.moving.progress * 100)}% of the way, {unit.moving.ground}
        </div>
      )}
      {commander && (
        <div className="uc-chain">
          Takes orders from <em>{commander.name}</em>
        </div>
      )}
    </motion.div>
  );
}

export function MapView({ state }: { state: GameState }) {
  const nodes = useStable(state.nodes ?? []);
  const edges = useStable(state.edges ?? []);
  const parchmentOk = useImageOk('/parchment.jpg');
  const nodeMap = useMemo(() => byId(nodes), [nodes]);
  const corners = useMemo(() => pickCorners(nodes), [nodes]);
  const units = state.units ?? [];
  const slots = useMemo(() => computeSlots(units, nodeMap), [units, nodeMap]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [battle, setBattle] = useState<string | null>(null);
  const { view, frameRef, onPointerDown, onClickCapture, zoomBy, reset } = useMapView();
  const vb = viewBox(view);

  const contested = useMemo(() => {
    const sides = new Map<string, Set<string>>();
    for (const u of units) {
      if (u.inReserve || u.status === 'reserve' || u.status === 'routed' || u.status === 'spent' || u.strength <= 0) continue;
      const s = sides.get(u.nodeId) ?? new Set<string>();
      s.add(u.side);
      sides.set(u.nodeId, s);
    }
    const out = new Set<string>();
    for (const [id, s] of sides) if (s.size > 1) out.add(id);
    return out;
  }, [units]);

  const objectiveHolder = useMemo(() => new Map((state.objectives ?? []).map((o) => [o.nodeId, o])), [state.objectives]);
  const shownId = hovered ?? selected;
  const shown = shownId ? units.find((u) => u.id === shownId) : undefined;
  const shownSlot = shown ? slots.get(shown.id) : undefined;
  // Where the unit actually is: on the road if it is marching, else at its place in line.
  const shownAt = useMemo((): [number, number] | null => {
    if (!shown || !shownSlot) return null;
    if (shown.moving) {
      const road = roadCurve(edges, nodeMap, shown.nodeId, shown.moving.to);
      if (road.length > 1) return pointAt(road, Math.max(0, shown.moving.progress - 0.08)) as [number, number];
    }
    return [shownSlot.x, shownSlot.y];
  }, [shown, shownSlot, edges, nodeMap]);
  const cmdById = useMemo(() => byId(state.commanders ?? []), [state.commanders]);
  const [cx, cy] = corners.cartouche;
  const battleNode = battle ? nodeMap.get(battle) : undefined;

  return (
    <div
      ref={frameRef}
      className={`map-frame ${view.k > 1 ? 'is-zoomed' : ''}`}
      onPointerDown={onPointerDown}
      onClickCapture={onClickCapture}
      onDoubleClick={(e) => { if (e.target === e.currentTarget) reset(); }}
      onClick={() => { setSelected(null); setBattle(null); }}
    >
      <svg className="map-svg map-static" viewBox={vb} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <MapBase nodes={nodes} edges={edges} battle={state.battle ?? ''} date={state.date ?? ''} parchmentOk={parchmentOk} />
      </svg>
      <TroopCanvas units={units} slots={slots} nodes={nodeMap} edges={edges} contested={contested} selectedId={selected} hoveredId={hovered} view={view} />
      <svg className="map-svg map-live" viewBox={vb} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Map of ${state.battle ?? 'the field'}`}>
        <defs>
          <pattern id="clio-contested" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="3" height="6" fill="#2f4b7c" />
            <rect x="3" width="3" height="6" fill="#8a3a30" />
          </pattern>
        </defs>

        <g className="cartouche-clock">
          <text x={cx + 200} y={cy + 132} textAnchor="middle" className="map-engraved" fontSize={21} fill="#2b2118" letterSpacing="1.5">
            {clock12(state.clock)}
            <tspan className="map-italic" fontSize={14} fill="#5a4a3a" dx={10} letterSpacing="0">
              {state.phase === 'ended' ? 'the field at nightfall' : `turn ${state.turn ?? 0} of ${state.maxTurns ?? 0}`}
            </tspan>
          </text>
        </g>

        {nodes.map((n) => {
          const o = objectiveHolder.get(n.id);
          if (!n.objective && !o) return null;
          return <Flag key={n.id} node={n} holder={o?.holder ?? 'empty'} historical={o?.historical ?? n.historical} />;
        })}

        {[...contested].map((id) => {
          const n = nodeMap.get(id);
          return n ? <Clash key={id} node={n} open={battle === id} onOpen={() => setBattle(battle === id ? null : id)} /> : null;
        })}

        <CourierLayer couriers={state.couriers ?? []} commanders={state.commanders ?? []} turn={state.turn ?? 0} nodes={nodeMap} edges={edges} />
        <UnitLayer units={units} slots={slots} nodes={nodeMap} edges={edges} selectedId={selected} onHover={setHovered} onSelect={setSelected} zoom={view.k} />
      </svg>

      <AnimatePresence>
        {battleNode && contested.has(battleNode.id) && <BattleCard key={'battle-' + battleNode.id} state={state} node={battleNode} at={project(view, battleNode.x, battleNode.y)} onClose={() => setBattle(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {shown && shownAt && <UnitCard key={shown.id} unit={shown} commander={cmdById.get(shown.commanderId)} x={project(view, shownAt[0], shownAt[1])[0]} y={project(view, shownAt[0], shownAt[1])[1]} />}
      </AnimatePresence>

      <div className="map-zoom" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => zoomBy(1.6)} disabled={view.k >= MAX_ZOOM - 0.01} aria-label="Zoom in">+</button>
        <span className="map-zoom-k">{view.k.toFixed(1)}×</span>
        <button type="button" onClick={() => zoomBy(1 / 1.6)} disabled={view.k <= 1.001} aria-label="Zoom out">−</button>
        <button type="button" className="map-zoom-home" onClick={reset} disabled={view.k <= 1.001} aria-label="Show the whole field">Whole field</button>
      </div>
      {view.k <= 1.001 && <div className="map-zoom-hint" aria-hidden="true">Scroll to zoom · drag to move</div>}

      <div className="map-legend" aria-hidden="true">
        <span className="lg lg-union">Union</span>
        <span className="lg lg-csa">Confederate</span>
        <span className="lg lg-reserve">In reserve</span>
        <span className="lg lg-pips">one dot is about fifty men</span>
      </div>
    </div>
  );
}
