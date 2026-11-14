import { memo, useEffect, useMemo, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { MapEdge, MapNode, Unit } from '../../../shared/types';
import { type Slot, edgePoints, findEdge, fmtInt } from '../geo';
import { MARCH_MS } from './TroopCanvas';

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
}

interface TagProps {
  unit: Unit;
  slot: Slot;
  nodes: Map<string, MapNode>;
  edges: MapEdge[];
  selected: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}

function UnitTagImpl({ unit, slot, nodes, edges, selected, onHover, onSelect }: TagProps) {
  const reduce = useReducedMotion();
  const last = useRef<{ nodeId: string } | null>(null);
  const first = last.current === null;

  // Follow the column along the road to the new place in line.
  const anim = useMemo(() => {
    const prev = last.current;
    if (prev && prev.nodeId !== unit.nodeId && !reduce) {
      const e = findEdge(edges, prev.nodeId, unit.nodeId);
      const mid = e ? edgePoints(e, nodes, prev.nodeId).slice(1, -1) : [];
      return { x: [null, ...mid.map((p) => p[0]), slot.x] as (number | null)[], y: [null, ...mid.map((p) => p[1]), slot.y] as (number | null)[], marching: true };
    }
    return { x: slot.x as number | (number | null)[], y: slot.y as number | (number | null)[], marching: false };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit.nodeId, slot.x, slot.y, reduce]);

  useEffect(() => {
    last.current = { nodeId: unit.nodeId };
  }, [unit.nodeId]);

  const reserve = !!unit.inReserve || unit.status === 'reserve';
  const routed = unit.status === 'routed' || unit.status === 'spent';
  const frac = Math.max(0, Math.min(1, unit.strength0 > 0 ? unit.strength / unit.strength0 : 0));
  const half = slot.front / 2;
  const dur = anim.marching ? MARCH_MS / 1000 : 0.7;

  return (
    <motion.g
      initial={first ? { x: slot.x, y: slot.y, opacity: 0 } : false}
      animate={{ x: anim.x, y: anim.y, opacity: 1 }}
      transition={reduce ? { duration: 0 } : { x: { duration: dur, ease: 'easeInOut' }, y: { duration: dur, ease: 'easeInOut' }, opacity: { duration: 0.6 } }}
      style={{ cursor: 'pointer' }}
      onMouseEnter={() => onHover(unit.id)}
      onMouseLeave={() => onHover(null)}
      onClick={(ev) => {
        ev.stopPropagation();
        onSelect(selected ? null : unit.id);
      }}
    >
      <g className={`unit-tag ${routed ? 'is-routed' : ''} ${reserve ? 'is-reserve' : ''}`}>
        <rect x={-slot.depth / 2 - 9} y={-half - 9} width={slot.depth + 18} height={slot.front + 30} fill="transparent" />
        {unit.agentId && (
          <path transform={`translate(${slot.depth / 2 + 9} ${-half - 2})`} d="M0 -6l1.6 3.4l3.7 .4l-2.8 2.5l.8 3.7l-3.3 -1.9l-3.3 1.9l.8 -3.7l-2.8 -2.5l3.7 -.4z" fill="#c59b3f" stroke="#2b2118" strokeWidth={0.7} />
        )}
        <text x={0} y={half + 15} textAnchor="middle" className="unit-label" fontSize={10.5}>
          {unit.short || unit.name}
          <tspan className="unit-count" dx={3.5} fontSize={8.6}>
            {fmtInt(unit.strength)}
          </tspan>
        </text>
        <rect x={-13} y={half + 18.5} width={26} height={2.2} fill="#eadbb3" stroke="#2b2118" strokeWidth={0.45} />
        <rect x={-13} y={half + 18.5} width={26 * frac} height={2.2} fill={frac < 0.5 ? '#9c2f25' : '#2b2118'} style={{ transition: 'width 900ms ease' }} />
      </g>
    </motion.g>
  );
}

const UnitTag = memo(UnitTagImpl);

function UnitLayerImpl({ units, slots, nodes, edges, selectedId, onHover, onSelect }: Props) {
  return (
    <g className="unit-layer">
      {units.map((u) => {
        const slot = slots.get(u.id);
        if (!slot || u.strength <= 0) return null;
        return <UnitTag key={u.id} unit={u} slot={slot} nodes={nodes} edges={edges} selected={selectedId === u.id} onHover={onHover} onSelect={onSelect} />;
      })}
    </g>
  );
}

export const UnitLayer = memo(UnitLayerImpl);
