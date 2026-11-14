import { memo, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { MapEdge, MapNode, Unit } from '../../../shared/types';
import { type Slot, findEdge, fmtInt, pointAt, roadCurve } from '../geo';
import { marchSeconds } from './TroopCanvas';

// The soldiers themselves are drawn by TroopCanvas. This layer carries what belongs to each
// formation as a whole: its name and strength, and the area that answers to the pointer.

interface Props {
  units: Unit[];
  slots: Map<string, Slot>;
  nodes: Map<string, MapNode>;
  edges: MapEdge[];
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  zoom?: number;
}

interface TagProps {
  zoom: number;
  unit: Unit;
  slot: Slot;
  nodes: Map<string, MapNode>;
  edges: MapEdge[];
  selected: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}

function UnitTagImpl({ unit, slot, nodes, edges, selected, onHover, onSelect, zoom }: TagProps) {
  const reduce = useReducedMotion();
  const last = useRef<{ nodeId: string; x: number; y: number } | null>(null);
  const first = last.current === null;

  // Where the name belongs: under the line when formed, beside the column when it is on the road.
  let x = slot.x;
  let y = slot.y;
  const onRoad = !!unit.moving;
  if (unit.moving) {
    const road = roadCurve(edges, nodes, unit.nodeId, unit.moving.to);
    if (road.length > 1) [x, y] = pointAt(road, Math.max(0, unit.moving.progress - 0.08));
  }
  const prev = last.current;
  const dist = prev ? Math.hypot(x - prev.x, y - prev.y) : 0;
  // A jump between two places with no road between them is the field being reset.
  const reset = !!prev && prev.nodeId !== unit.nodeId && !findEdge(edges, prev.nodeId, unit.nodeId);
  const dur = reset ? 0.01 : dist > 12 ? marchSeconds(dist, unit.strength) : 0.6;

  useEffect(() => {
    last.current = { nodeId: unit.nodeId, x, y };
  }, [unit.nodeId, x, y]);

  const reserve = !!unit.inReserve || unit.status === 'reserve';
  const routed = unit.status === 'routed' || unit.status === 'spent';
  const frac = Math.max(0, Math.min(1, unit.strength0 > 0 ? unit.strength / unit.strength0 : 0));
  const half = onRoad ? 12 : slot.front / 2;

  return (
    <motion.g
      initial={first ? { x, y, opacity: 0 } : false}
      animate={{ x, y, opacity: 1 }}
      transition={reduce ? { duration: 0 } : { x: { duration: dur, ease: 'linear' }, y: { duration: dur, ease: 'linear' }, opacity: { duration: 0.6 } }}
      style={{ cursor: 'pointer' }}
      onMouseEnter={() => onHover(unit.id)}
      onMouseLeave={() => onHover(null)}
      onClick={(ev) => {
        ev.stopPropagation();
        onSelect(selected ? null : unit.id);
      }}
    >
      <g className={`unit-tag ${routed ? 'is-routed' : ''} ${reserve ? 'is-reserve' : ''}`}>
        <rect x={-slot.depth / 2 - 12} y={-half - 12} width={slot.depth + 24} height={half * 2 + 40} fill="transparent" />
        {unit.agentId && (
          <path transform={`translate(${slot.depth / 2 + 12} ${-half - 2}) scale(1.35)`} d="M0 -6l1.6 3.4l3.7 .4l-2.8 2.5l.8 3.7l-3.3 -1.9l-3.3 1.9l.8 -3.7l-2.8 -2.5l3.7 -.4z" fill="#c59b3f" stroke="#2b2118" strokeWidth={0.7} />
        )}
        {/* Labels grow more slowly than the map, so zooming in makes room for detail rather than for bigger type. */}
        <g transform={`translate(0 ${half}) scale(${(1 / Math.sqrt(zoom)).toFixed(3)}) translate(0 ${-half})`}>
        <text x={0} y={half + 19} textAnchor="middle" className="unit-label" fontSize={13.5}>
          {unit.short || unit.name}
          <tspan className="unit-count" dx={4} fontSize={10.8}>
            {fmtInt(unit.strength)}
          </tspan>
        </text>
        <rect x={-18} y={half + 23.5} width={36} height={2.8} fill="#eadbb3" stroke="#2b2118" strokeWidth={0.5} />
        <rect x={-18} y={half + 23.5} width={36 * frac} height={2.8} fill={frac < 0.5 ? '#9c2f25' : '#2b2118'} style={{ transition: 'width 900ms ease' }} />
        {unit.moving && (
          <text x={0} y={half + 37} textAnchor="middle" className="unit-ground" fontSize={9.6}>
            {unit.moving.ground}
          </text>
        )}
        {zoom >= 1.8 && (
          <g className="unit-detail">
            <text x={0} y={half + (unit.moving ? 50 : 38)} textAnchor="middle" fontSize={10.2}>{unit.leader}</text>
            <text x={0} y={half + (unit.moving ? 63 : 51)} textAnchor="middle" fontSize={9.6}>
              morale {Math.round(unit.morale)} · ammunition {Math.round(unit.ammo)} · fatigue {Math.round(unit.fatigue)}
            </text>
            {unit.order?.label && (
              <text x={0} y={half + (unit.moving ? 76 : 64)} textAnchor="middle" fontSize={9.6} className="unit-detail-order">
                {unit.order.label}
              </text>
            )}
          </g>
        )}
        </g>
      </g>
    </motion.g>
  );
}

const UnitTag = memo(UnitTagImpl);

function UnitLayerImpl({ units, slots, nodes, edges, selectedId, onHover, onSelect, zoom }: Props) {
  return (
    <g className="unit-layer">
      {units.map((u) => {
        const slot = slots.get(u.id);
        if (!slot || u.strength <= 0) return null;
        return <UnitTag key={u.id} unit={u} slot={slot} nodes={nodes} edges={edges} selected={selectedId === u.id} onHover={onHover} onSelect={onSelect} zoom={zoom ?? 1} />;
      })}
    </g>
  );
}

export const UnitLayer = memo(UnitLayerImpl);
