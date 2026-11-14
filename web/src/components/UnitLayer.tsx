import { memo, useEffect, useMemo, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { MapEdge, MapNode, Unit } from '../../../shared/types';
import { type Slot, edgePoints, findEdge, unitWidth } from '../geo';

interface Props {
  units: Unit[];
  slots: Map<string, Slot>;
  nodes: Map<string, MapNode>;
  edges: MapEdge[];
  contested: Set<string>;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}

const FILL = { union: '#2f4b7c', confederate: '#6f6c68' } as const;
const EDGE = { union: '#16263f', confederate: '#3a302a' } as const;
const ACCENT = { union: '#c9d6ea', confederate: '#b0483c' } as const;

interface BlockProps {
  unit: Unit;
  slot: Slot;
  nodes: Map<string, MapNode>;
  edges: MapEdge[];
  inContact: boolean;
  selected: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}

function UnitBlockImpl({ unit, slot, nodes, edges, inContact, selected, onHover, onSelect }: BlockProps) {
  const reduce = useReducedMotion();
  const last = useRef<{ nodeId: string; x: number; y: number } | null>(null);
  const first = last.current === null;

  // Build the march: from where the block was, along the road, to its new place in line.
  const anim = useMemo(() => {
    const prev = last.current;
    if (prev && prev.nodeId !== unit.nodeId && !reduce) {
      const e = findEdge(edges, prev.nodeId, unit.nodeId);
      const mid = e ? edgePoints(e, nodes, prev.nodeId).slice(1, -1) : [];
      return {
        x: [null, ...mid.map((p) => p[0]), slot.x] as (number | null)[],
        y: [null, ...mid.map((p) => p[1]), slot.y] as (number | null)[],
        marching: true,
      };
    }
    return { x: slot.x as number | (number | null)[], y: slot.y as number | (number | null)[], marching: false };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit.nodeId, slot.x, slot.y, reduce]);

  useEffect(() => {
    last.current = { nodeId: unit.nodeId, x: slot.x, y: slot.y };
  }, [unit.nodeId, slot.x, slot.y]);

  const w = unitWidth(unit);
  const h = 21;
  const frac = Math.max(0, Math.min(1, unit.strength0 > 0 ? unit.strength / unit.strength0 : 0));
  const moralePips = Math.max(0, Math.min(4, Math.ceil((unit.morale ?? 0) / 25)));
  const ammoPips = Math.max(0, Math.min(3, Math.ceil((unit.ammo ?? 0) / 34)));
  const reserve = !!unit.inReserve || unit.status === 'reserve';
  const routed = unit.status === 'routed' || unit.status === 'spent';
  const engaged = unit.status === 'engaged' || (inContact && !routed && !reserve);
  const shaken = unit.status === 'shaken';
  const sat = 0.45 + 0.55 * Math.max(0, Math.min(1, (unit.morale ?? 0) / 100));
  const face = unit.side === 'confederate' ? 1 : -1; // toward the enemy

  return (
    <motion.g
      initial={first ? { x: slot.x, y: slot.y, opacity: 0 } : false}
      animate={{ x: anim.x, y: anim.y, opacity: 1 }}
      transition={
        reduce
          ? { duration: 0 }
          : { x: { duration: anim.marching ? 1.25 : 0.7, ease: [0.4, 0, 0.2, 1] }, y: { duration: anim.marching ? 1.25 : 0.7, ease: [0.4, 0, 0.2, 1] }, opacity: { duration: 0.6 } }
      }
      style={{ cursor: 'pointer' }}
      onMouseEnter={() => onHover(unit.id)}
      onMouseLeave={() => onHover(null)}
      onClick={(ev) => {
        ev.stopPropagation();
        onSelect(selected ? null : unit.id);
      }}
    >
      <g className={`unit ${shaken ? 'is-shaken' : ''} ${routed ? 'is-routed' : ''}`} style={{ filter: `saturate(${sat.toFixed(2)})` }}>
        {selected && <rect x={-w / 2 - 5} y={-h / 2 - 9} width={w + 10} height={h + 30} fill="none" stroke="#a8843a" strokeWidth={1.4} strokeDasharray="3 3" />}
        <rect x={-w / 2 + 1.5} y={-h / 2 + 2} width={w} height={h} fill="#2b2118" opacity={0.28} />
        <rect
          x={-w / 2}
          y={-h / 2}
          width={w}
          height={h}
          rx={1}
          fill={reserve ? '#e6d6ab' : FILL[unit.side]}
          fillOpacity={reserve ? 0.75 : 1}
          stroke={EDGE[unit.side]}
          strokeWidth={1.5}
          strokeDasharray={reserve ? '4 2.5' : routed ? '2 3' : undefined}
        />
        <path
          d={`M${-w / 2} ${-h / 2}L${w / 2} ${h / 2}M${-w / 2} ${h / 2}L${w / 2} ${-h / 2}`}
          stroke={reserve ? FILL[unit.side] : ACCENT[unit.side]}
          strokeWidth={1.05}
          opacity={0.85}
        />
        {unit.side === 'confederate' && !reserve && <rect x={-w / 2} y={-h / 2} width={3.5} height={h} fill="#8a3a30" />}
        {unit.agentId && (
          <path transform={`translate(${w / 2 - 1} ${-h / 2 - 1})`} d="M0 -6l1.6 3.4l3.7 .4l-2.8 2.5l.8 3.7l-3.3 -1.9l-3.3 1.9l.8 -3.7l-2.8 -2.5l3.7 -.4z" fill="#c59b3f" stroke="#2b2118" strokeWidth={0.7} />
        )}
        {/* morale */}
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={-w / 2 + i * 6} y={-h / 2 - 6.5} width={4.5} height={3.6} fill={i < moralePips ? '#2b2118' : 'none'} stroke="#2b2118" strokeWidth={0.6} opacity={0.85} />
        ))}
        {/* ammunition */}
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={w / 2 - 2.5 - i * 5.5 - (unit.agentId ? 9 : 0)} cy={-h / 2 - 4.7} r={1.9} fill={i < ammoPips ? '#8a5a1f' : 'none'} stroke="#2b2118" strokeWidth={0.6} opacity={0.9} />
        ))}
        {/* strength */}
        <rect x={-w / 2} y={h / 2 + 2.5} width={w} height={3.4} fill="#eadbb3" stroke="#2b2118" strokeWidth={0.6} />
        <rect x={-w / 2} y={h / 2 + 2.5} width={w * frac} height={3.4} fill={frac < 0.5 ? '#9c2f25' : '#2b2118'} style={{ transition: 'width 900ms ease' }} />
        <text x={0} y={h / 2 + 17.5} textAnchor="middle" className="unit-label" fontSize={11.5}>
          {unit.short || unit.name}
        </text>
        {engaged && (
          <g>
            <path className="volley" d={`M${(face * (w / 2 + 3)).toFixed(1)} ${-h / 2}V${h / 2}`} stroke="#f1b23c" strokeWidth={2.2} strokeLinecap="round" />
            {[0, 1, 2].map((i) => (
              <circle key={i} className="smoke" cx={face * (w / 2 + 7)} cy={-6 + i * 6} r={4.5} fill="#f4efe2" stroke="#8d8676" strokeWidth={0.4} style={{ animationDelay: `${i * 0.45}s` }} />
            ))}
          </g>
        )}
        <rect x={-w / 2 - 4} y={-h / 2 - 10} width={w + 8} height={h + 32} fill="transparent" />
      </g>
    </motion.g>
  );
}

const UnitBlock = memo(UnitBlockImpl);

function UnitLayerImpl({ units, slots, nodes, edges, contested, selectedId, onHover, onSelect }: Props) {
  return (
    <g className="unit-layer">
      {units.map((u) => {
        const slot = slots.get(u.id);
        if (!slot) return null;
        return (
          <UnitBlock
            key={u.id}
            unit={u}
            slot={slot}
            nodes={nodes}
            edges={edges}
            inContact={contested.has(u.nodeId)}
            selected={selectedId === u.id}
            onHover={onHover}
            onSelect={onSelect}
          />
        );
      })}
    </g>
  );
}

export const UnitLayer = memo(UnitLayerImpl);
