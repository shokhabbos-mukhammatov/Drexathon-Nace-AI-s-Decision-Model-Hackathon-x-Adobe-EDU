import { memo, useEffect, useMemo, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { Commander, Courier, MapEdge, MapNode } from '../../../shared/types';
import { type Pt, linePath, pointAt, routePoints, sliceBetween } from '../geo';

export const COURIER_INK: Record<Courier['kind'], string> = {
  order: '#2b2118',
  protest: '#9c2f25',
  request: '#a8843a',
  reply: '#3d6b4f',
};

const KIND_WORD: Record<Courier['kind'], string> = {
  order: 'Order',
  protest: 'Protest',
  request: 'Request',
  reply: 'Reply',
};

interface RiderProps {
  courier: Courier;
  turn: number;
  nodes: Map<string, MapNode>;
  edges: MapEdge[];
  names: Map<string, string>;
}

function RiderImpl({ courier, turn, nodes, edges, names }: RiderProps) {
  const reduce = useReducedMotion();
  const pathKey = (courier.path ?? []).join('>');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pts = useMemo(() => routePoints(courier.path ?? [], nodes, edges), [pathKey, nodes, edges]);
  const span = Math.max(1, (courier.arriveTurn ?? 0) - (courier.departTurn ?? 0));
  const f = courier.delivered ? 1 : Math.max(0, Math.min(1, (turn - courier.departTurn) / span));
  const lastF = useRef<number | null>(null);
  const first = lastF.current === null;

  const leg = useMemo<Pt[]>(() => {
    const from = lastF.current ?? 0;
    return sliceBetween(pts, from, f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pts, f]);

  useEffect(() => {
    lastF.current = f;
  }, [f]);

  if (pts.length < 2) return null;
  const here = pointAt(pts, f);
  const start = pointAt(pts, first ? 0 : (lastF.current ?? 0));
  const ink = COURIER_INK[courier.kind] ?? '#2b2118';
  const goingLeft = pts[pts.length - 1][0] < pts[0][0];
  const xs = leg.map((p) => p[0]);
  const ys = leg.map((p) => p[1]);
  const title = `${KIND_WORD[courier.kind] ?? 'Message'} · ${names.get(courier.fromId) ?? courier.fromId} to ${names.get(courier.toId) ?? courier.toId}: ${courier.text ?? ''}`;

  return (
    <g className="courier">
      <path d={linePath(pts)} fill="none" stroke={ink} strokeWidth={1.1} strokeDasharray="2 6" opacity={0.35} />
      <path d={linePath(sliceBetween(pts, 0, f))} fill="none" stroke={ink} strokeWidth={1.6} strokeDasharray="5 4" opacity={0.75} />
      <motion.g
        initial={{ x: start[0], y: start[1], opacity: 0 }}
        animate={{ x: xs.length > 1 ? xs : here[0], y: ys.length > 1 ? ys : here[1], opacity: courier.delivered ? 0 : 1 }}
        transition={reduce ? { duration: 0 } : { x: { duration: 1.6, ease: 'easeInOut' }, y: { duration: 1.6, ease: 'easeInOut' }, opacity: { duration: courier.delivered ? 1.8 : 0.4, delay: courier.delivered ? 1.2 : 0 } }}
      >
        <title>{title}</title>
        <g transform={`scale(${goingLeft ? -1.5 : 1.5} 1.5)`}>
          <g className="gallop">
            <circle r={13} fill="#eadbb3" fillOpacity={0.85} stroke={ink} strokeWidth={1} />
            {/* horse and rider, drawn small */}
            <path d="M-8 1c2 -3 6 -3.4 9 -2.4l3.2 -3.6l2.6 .6l-1 2.6l1.6 2.2l-2 .9l-1.8 -1.4l-.8 3.2l1.6 4.4h-1.6l-2.4 -3.8l-4.6 .2l-2 3.6h-1.6l1.2 -4.6z" fill={ink} />
            <path d="M-1 -2.4l.4 -4.2l1.8 .2l.4 4z" fill={ink} />
            <circle cx={0.4} cy={-7.8} r={1.5} fill={ink} />
            <path d="M-8 1l-2.6 2.2" stroke={ink} strokeWidth={1} strokeLinecap="round" />
          </g>
        </g>
        <path transform="scale(1.5)" d="M0 -13v-9l8 3l-8 3" fill={ink} stroke={ink} strokeWidth={0.8} strokeLinejoin="round" />
      </motion.g>
    </g>
  );
}

const Rider = memo(RiderImpl);

interface Props {
  couriers: Courier[];
  commanders: Commander[];
  turn: number;
  nodes: Map<string, MapNode>;
  edges: MapEdge[];
}

function CourierLayerImpl({ couriers, commanders, turn, nodes, edges }: Props) {
  const names = useMemo(() => new Map(commanders.map((c) => [c.id, c.name])), [commanders]);
  // Riders that came in more than a turn ago have left the map.
  const live = (couriers ?? []).filter((c) => !(c.delivered && turn > (c.arriveTurn ?? 0) + 1) && turn >= (c.departTurn ?? 0));
  return (
    <g className="courier-layer">
      {live.map((c) => (
        <Rider key={c.id} courier={c} turn={turn} nodes={nodes} edges={edges} names={names} />
      ))}
    </g>
  );
}

export const CourierLayer = memo(CourierLayerImpl);
