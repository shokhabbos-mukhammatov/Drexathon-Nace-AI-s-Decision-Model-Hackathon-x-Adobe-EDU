import { memo, useMemo } from 'react';
import type { MapEdge, MapNode } from '../../../shared/types';
import { MAP_H, MAP_W, type Pt, byId, edgePoints, hash, polyLength, rng, smoothPath } from '../geo';
import { Countryside } from './Countryside';

const INK = '#2b2118';
const INK_SOFT = '#5a4a3a';

interface Props {
  nodes: MapNode[];
  edges: MapEdge[];
  battle: string;
  date: string;
  parchmentOk: boolean;
}

export interface Corners {
  cartouche: Pt;
  compass: Pt;
  scale: Pt;
}

/** Puts the cartouche, compass and scale bar in the emptiest corners of this particular map. */
export function pickCorners(nodes: MapNode[]): Corners {
  const corners: { id: string; x: number; y: number; top: boolean; left: boolean }[] = [
    { id: 'tl', x: 0, y: 0, top: true, left: true },
    { id: 'tr', x: MAP_W, y: 0, top: true, left: false },
    { id: 'bl', x: 0, y: MAP_H, top: false, left: true },
    { id: 'br', x: MAP_W, y: MAP_H, top: false, left: false },
  ];
  const scored = corners
    .map((c) => {
      let score = c.top ? -0.25 : 0;
      for (const n of nodes) {
        const dx = Math.abs(n.x - c.x);
        const dy = Math.abs(n.y - c.y);
        if (dx < 520 && dy < 300) score += 1 + (520 - dx) / 520 + (300 - dy) / 300;
      }
      return { c, score };
    })
    .sort((a, b) => a.score - b.score);
  const at = (i: number, w: number, h: number): Pt => {
    const c = scored[i].c;
    return [c.left ? 46 : MAP_W - 46 - w, c.top ? 46 : MAP_H - 46 - h];
  };
  return { cartouche: at(0, 400, 150), compass: at(1, 150, 150), scale: at(2, 300, 54) };
}

function ridge(n: MapNode, angle: number, r: () => number): string {
  const L = 190;
  const steps = 30;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const px = -sin;
  const py = cos;
  let d = '';
  const bow = (r() - 0.5) * 26;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps - 0.5;
    const taper = 1 - Math.pow(Math.abs(t) * 2, 2.4);
    const cx = n.x + cos * t * L + px * bow * (1 - 4 * t * t);
    const cy = n.y + sin * t * L + py * bow * (1 - 4 * t * t);
    for (const s of [-1, 1]) {
      const len = (9 + r() * 12) * taper + 3;
      const o0 = 5 + r() * 2;
      const slant = (r() - 0.5) * 5;
      d += `M${(cx + px * s * o0).toFixed(1)} ${(cy + py * s * o0).toFixed(1)}L${(cx + px * s * (o0 + len) + cos * slant).toFixed(1)} ${(cy + py * s * (o0 + len) + sin * slant).toFixed(1)}`;
    }
  }
  return d;
}

function hill(n: MapNode, r: () => number): string {
  const rx = 74 + r() * 14;
  const ry = 56 + r() * 12;
  const rot = (r() - 0.5) * 1.1;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  let d = '';
  const ring = (count: number, outer: number, inner: number) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + r() * 0.05;
      const wob = 1 + (r() - 0.5) * 0.08;
      const p = (k: number): Pt => {
        const ex = Math.cos(a) * rx * k * wob;
        const ey = Math.sin(a) * ry * k * wob;
        return [n.x + ex * c - ey * s, n.y + ex * s + ey * c];
      };
      const p0 = p(outer);
      const p1 = p(inner + r() * 0.05);
      d += `M${p0[0].toFixed(1)} ${p0[1].toFixed(1)}L${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`;
    }
  };
  ring(58, 1, 0.8);
  ring(40, 0.72, 0.54);
  ring(22, 0.44, 0.3);
  return d;
}

function scatter(n: MapNode, r: () => number, count: number, radius: number, hole: number): Pt[] {
  const out: Pt[] = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 8) {
    const a = r() * Math.PI * 2;
    const rad = hole + Math.sqrt(r()) * (radius - hole);
    const p: Pt = [n.x + Math.cos(a) * rad * 1.15, n.y + Math.sin(a) * rad * 0.85];
    if (p[0] < 30 || p[0] > MAP_W - 30 || p[1] < 30 || p[1] > MAP_H - 30) continue;
    out.push(p);
  }
  return out.sort((a, b) => a[1] - b[1]);
}

function rock(p: Pt, r: () => number): string {
  const k = 5 + Math.floor(r() * 3);
  const rad = 4.5 + r() * 8;
  const pts: string[] = [];
  for (let i = 0; i < k; i++) {
    const a = (i / k) * Math.PI * 2 + r() * 0.5;
    const rr = rad * (0.7 + r() * 0.5);
    pts.push(`${(p[0] + Math.cos(a) * rr).toFixed(1)} ${(p[1] + Math.sin(a) * rr * 0.75).toFixed(1)}`);
  }
  return 'M' + pts.join('L') + 'Z';
}

function Terrain({ n, angle }: { n: MapNode; angle: number }) {
  const r = rng(hash(n.id) ^ 0x9e3779b9);
  switch (n.terrain) {
    case 'ridge':
      return (
        <g>
          <ellipse cx={n.x} cy={n.y} rx={120} ry={46} fill="#8a6a3a" opacity={0.16} filter="url(#clio-soft)" transform={`rotate(${(angle * 180) / Math.PI} ${n.x} ${n.y})`} />
          <path d={ridge(n, angle, r)} stroke={INK} strokeWidth={0.9} opacity={0.72} fill="none" strokeLinecap="round" />
        </g>
      );
    case 'hill':
      return (
        <g>
          <ellipse cx={n.x} cy={n.y} rx={86} ry={68} fill="#7d5f33" opacity={0.2} filter="url(#clio-soft)" />
          <path d={hill(n, r)} stroke={INK} strokeWidth={0.95} opacity={0.75} fill="none" strokeLinecap="round" />
        </g>
      );
    case 'woods': {
      const trees = scatter(n, r, 46, 92, 16);
      return (
        <g>
          <ellipse cx={n.x} cy={n.y} rx={104} ry={78} fill="#5d6b3a" opacity={0.2} filter="url(#clio-soft)" />
          {trees.map((p, i) => {
            const s = 4.5 + r() * 4;
            return (
              <g key={i}>
                <path d={`M${p[0].toFixed(1)} ${(p[1] + s).toFixed(1)}v${(s * 0.7).toFixed(1)}`} stroke={INK} strokeWidth={0.8} opacity={0.6} />
                <circle cx={p[0]} cy={p[1]} r={s} fill="#cfc48a" fillOpacity={0.55} stroke={INK} strokeWidth={0.75} opacity={0.78} />
                <path d={`M${(p[0] - s * 0.5).toFixed(1)} ${(p[1] + s * 0.25).toFixed(1)}q${(s * 0.5).toFixed(1)} ${(s * 0.55).toFixed(1)} ${s.toFixed(1)} 0`} stroke={INK} strokeWidth={0.6} fill="none" opacity={0.6} />
              </g>
            );
          })}
        </g>
      );
    }
    case 'rocks': {
      const stones = scatter(n, r, 22, 78, 14);
      return (
        <g>
          <ellipse cx={n.x} cy={n.y} rx={92} ry={66} fill="#6f6658" opacity={0.2} filter="url(#clio-soft)" />
          {stones.map((p, i) => (
            <path key={i} d={rock(p, r)} fill="#d8cfb4" fillOpacity={0.7} stroke={INK} strokeWidth={0.85} opacity={0.82} strokeLinejoin="round" />
          ))}
          {stones.slice(0, 12).map((p, i) => (
            <path key={'s' + i} d={`M${(p[0] - 3).toFixed(1)} ${(p[1] + 1).toFixed(1)}l5 2`} stroke={INK} strokeWidth={0.6} opacity={0.55} />
          ))}
        </g>
      );
    }
    case 'farm': {
      const fields = [0, 1, 2].map(() => ({
        x: n.x + (r() - 0.5) * 130,
        y: n.y + (r() - 0.5) * 90,
        w: 46 + r() * 34,
        h: 28 + r() * 20,
        rot: (r() - 0.5) * 40,
      }));
      return (
        <g>
          <ellipse cx={n.x} cy={n.y} rx={96} ry={66} fill="#c9a94f" opacity={0.16} filter="url(#clio-soft)" />
          {fields.map((f, i) => (
            <g key={i} transform={`rotate(${f.rot.toFixed(1)} ${f.x.toFixed(1)} ${f.y.toFixed(1)})`} opacity={0.62}>
              <rect x={f.x - f.w / 2} y={f.y - f.h / 2} width={f.w} height={f.h} fill="url(#clio-furrow)" stroke={INK} strokeWidth={0.7} strokeDasharray="5 2 1 2" />
            </g>
          ))}
          <g transform={`translate(${(n.x + 20).toFixed(1)} ${(n.y + 22).toFixed(1)})`} opacity={0.85}>
            <path d="M-7 0h14v-7l-7 -6l-7 6z" fill="#d9cba3" stroke={INK} strokeWidth={0.9} strokeLinejoin="round" />
            <path d="M10 -2h8v-5h-8z" fill="#d9cba3" stroke={INK} strokeWidth={0.8} />
          </g>
        </g>
      );
    }
    default: {
      const tufts = scatter(n, r, 14, 84, 20);
      return (
        <g opacity={0.5}>
          {tufts.map((p, i) => (
            <path key={i} d={`M${p[0].toFixed(1)} ${p[1].toFixed(1)}l-2 -5m2 5l0 -6m0 6l2 -5`} stroke={INK_SOFT} strokeWidth={0.6} fill="none" />
          ))}
        </g>
      );
    }
  }
}

function Compass({ at }: { at: Pt }) {
  const cx = at[0] + 75;
  const cy = at[1] + 78;
  const pts = (len: number, wid: number, rot: number) => {
    const a = (rot * Math.PI) / 180;
    const tip: Pt = [cx + Math.sin(a) * len, cy - Math.cos(a) * len];
    const l: Pt = [cx + Math.sin(a - Math.PI / 2) * wid, cy - Math.cos(a - Math.PI / 2) * wid];
    const rr: Pt = [cx + Math.sin(a + Math.PI / 2) * wid, cy - Math.cos(a + Math.PI / 2) * wid];
    return { tip, l, rr };
  };
  return (
    <g>
      <circle cx={cx} cy={cy} r={52} fill="none" stroke={INK} strokeWidth={0.8} opacity={0.7} />
      <circle cx={cx} cy={cy} r={47} fill="none" stroke={INK} strokeWidth={0.5} opacity={0.6} strokeDasharray="1 3.1" />
      {[45, 135, 225, 315].map((rot) => {
        const p = pts(36, 6, rot);
        return <path key={rot} d={`M${p.tip[0]} ${p.tip[1]}L${p.l[0]} ${p.l[1]}L${p.rr[0]} ${p.rr[1]}Z`} fill="#cdb98a" stroke={INK} strokeWidth={0.6} />;
      })}
      {[0, 90, 180, 270].map((rot) => {
        const p = pts(rot === 0 ? 60 : 48, 8, rot);
        return (
          <g key={rot}>
            <path d={`M${p.tip[0]} ${p.tip[1]}L${p.l[0]} ${p.l[1]}L${cx} ${cy}Z`} fill={INK} />
            <path d={`M${p.tip[0]} ${p.tip[1]}L${p.rr[0]} ${p.rr[1]}L${cx} ${cy}Z`} fill="#e4d3a6" stroke={INK} strokeWidth={0.6} />
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={3} fill="#a8843a" stroke={INK} strokeWidth={0.6} />
      <text x={cx} y={cy - 64} textAnchor="middle" className="map-engraved" fontSize={20} fill={INK}>
        N
      </text>
    </g>
  );
}

function ScaleBar({ at }: { at: Pt }) {
  const x = at[0] + 20;
  const y = at[1] + 30;
  const seg = 65;
  return (
    <g>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={x + i * seg} y={y} width={seg} height={7} fill={i % 2 === 0 ? INK : '#e4d3a6'} stroke={INK} strokeWidth={0.7} />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <text key={i} x={x + i * seg} y={y - 5} textAnchor="middle" className="map-italic" fontSize={12} fill={INK}>
          {i === 0 ? '0' : i === 2 ? '½' : i === 4 ? '1 mile' : ''}
        </text>
      ))}
      <text x={x + seg * 2} y={y + 24} textAnchor="middle" className="map-italic" fontSize={12} fill={INK_SOFT}>
        Scale approximate
      </text>
    </g>
  );
}

function CartoucheFrame({ at, battle, date }: { at: Pt; battle: string; date: string }) {
  const [x, y] = at;
  const w = 400;
  const h = 150;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#eadbb3" fillOpacity={0.9} stroke={INK} strokeWidth={1.6} />
      <rect x={x + 6} y={y + 6} width={w - 12} height={h - 12} fill="none" stroke={INK} strokeWidth={0.6} />
      {[
        [x + 6, y + 6, 1, 1],
        [x + w - 6, y + 6, -1, 1],
        [x + 6, y + h - 6, 1, -1],
        [x + w - 6, y + h - 6, -1, -1],
      ].map(([cx, cy, sx, sy], i) => (
        <path key={i} d={`M${cx} ${cy + 16 * sy}q${8 * sx} ${-8 * sy} ${16 * sx} ${-16 * sy}`} fill="none" stroke={INK} strokeWidth={0.7} />
      ))}
      <text x={x + w / 2} y={y + 34} textAnchor="middle" className="map-italic" fontSize={14} fill={INK_SOFT}>
        A map of the field of
      </text>
      <text x={x + w / 2} y={y + 68} textAnchor="middle" className="map-engraved" fontSize={battle.length > 22 ? 24 : 30} fill={INK} letterSpacing="2">
        {battle || 'The field'}
      </text>
      <path d={`M${x + 90} ${y + 80}h${w - 180}`} stroke={INK} strokeWidth={0.6} />
      <path d={`M${x + w / 2 - 5} ${y + 80}l5 -4l5 4l-5 4z`} fill={INK} />
      <text x={x + w / 2} y={y + 101} textAnchor="middle" className="map-italic" fontSize={15} fill={INK}>
        {date}
      </text>
    </g>
  );
}

function MapBaseImpl({ nodes, edges, battle, date, parchmentOk }: Props) {
  const model = useMemo(() => {
    const nm = byId(nodes);
    const corners = pickCorners(nodes);
    const elevated = nodes.filter((n) => n.terrain === 'ridge' || n.terrain === 'hill');
    const angles = new Map<string, number>();
    for (const n of nodes) {
      if (n.terrain !== 'ridge') continue;
      let best: MapNode | undefined;
      let bestD = Infinity;
      for (const o of elevated) {
        if (o.id === n.id) continue;
        const linked = edges.some((e) => (e.a === n.id && e.b === o.id) || (e.b === n.id && e.a === o.id));
        const d = Math.hypot(o.x - n.x, o.y - n.y) * (linked ? 0.6 : 1) * (o.terrain === 'ridge' ? 0.8 : 1);
        if (d < bestD) {
          bestD = d;
          best = o;
        }
      }
      angles.set(n.id, best ? Math.atan2(best.y - n.y, best.x - n.x) : Math.PI / 2);
    }
    const roads = edges
      .map((e, i) => {
        const pts = edgePoints(e, nm);
        return { e, i, pts, d: smoothPath(pts), len: polyLength(pts) };
      })
      .filter((r) => r.pts.length > 1);
    // One lettered label per named road, on its longest stretch, reading left to right.
    const named = new Map<string, (typeof roads)[number]>();
    for (const r of roads) {
      if (!r.e.road) continue;
      const cur = named.get(r.e.road);
      if (!cur || r.len > cur.len) named.set(r.e.road, r);
    }
    const labels = [...named.entries()].map(([name, r]) => {
      const first = r.pts[0];
      const last = r.pts[r.pts.length - 1];
      const pts = first[0] <= last[0] ? r.pts : r.pts.slice().reverse();
      return { name, id: 'clio-road-' + r.i, d: smoothPath(pts) };
    });
    const fr = rng(hash(nodes.map((n) => n.id).join(',')) || 7);
    const foxing = Array.from({ length: 26 }, () => ({ x: fr() * MAP_W, y: fr() * MAP_H, r: 6 + fr() * 34, o: 0.03 + fr() * 0.07 }));
    // Keep the fields clear of the cartouche, compass and scale bar.
    const avoid: Pt[] = [[corners.cartouche[0] + 200, corners.cartouche[1] + 75], [corners.compass[0] + 75, corners.compass[1] + 75], [corners.scale[0] + 150, corners.scale[1] + 27]];
    return { nm, corners, angles, roads, labels, foxing, avoid };
  }, [nodes, edges]);

  const ticks: number[] = [];
  for (let v = 100; v < MAP_W; v += 100) ticks.push(v);

  return (
    <g className="map-base">
      <defs>
        <filter id="clio-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.36  0 0 0 0 0.27  0 0 0 0 0.16  0 0 0 0.55 -0.18" />
        </filter>
        <filter id="clio-fibre" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.05" numOctaves="3" seed="19" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.33  0 0 0 0 0.17  0 0 0 0.5 -0.17" />
        </filter>
        <filter id="clio-soft" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
        <filter id="clio-rough" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="3" result="t" />
          <feDisplacementMap in="SourceGraphic" in2="t" scale="2.4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <radialGradient id="clio-vignette" cx="50%" cy="50%" r="72%">
          <stop offset="55%" stopColor="#5b3d16" stopOpacity="0" />
          <stop offset="88%" stopColor="#5b3d16" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#3a2408" stopOpacity="0.46" />
        </radialGradient>
        <pattern id="clio-furrow" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
          <path d="M0 2.5h5" stroke={INK} strokeWidth="0.5" opacity="0.6" />
        </pattern>
      </defs>

      <rect width={MAP_W} height={MAP_H} fill="#e8d8ae" />
      {parchmentOk && <image href="/parchment.jpg" width={MAP_W} height={MAP_H} preserveAspectRatio="xMidYMid slice" />}
      {!parchmentOk && (
        <>
          <rect width={MAP_W} height={MAP_H} filter="url(#clio-fibre)" opacity={0.75} />
          {model.foxing.map((f, i) => (
            <circle key={i} cx={f.x} cy={f.y} r={f.r} fill="#7a4a1c" opacity={f.o} filter="url(#clio-soft)" />
          ))}
        </>
      )}
      <rect width={MAP_W} height={MAP_H} filter="url(#clio-grain)" opacity={parchmentOk ? 0.35 : 0.6} />

      <g opacity={0.2} stroke={INK} strokeWidth={0.5}>
        {ticks.filter((v) => v % 200 === 0).map((v) => (
          <path key={'gx' + v} d={`M${v} 30V${MAP_H - 30}`} strokeDasharray="2 7" />
        ))}
        {ticks.filter((v) => v % 200 === 0 && v < MAP_H).map((v) => (
          <path key={'gy' + v} d={`M30 ${v}H${MAP_W - 30}`} strokeDasharray="2 7" />
        ))}
      </g>

      <Countryside nodes={nodes} avoid={model.avoid} />

      <g filter="url(#clio-rough)">
        {nodes.map((n) => (
          <Terrain key={n.id} n={n} angle={model.angles.get(n.id) ?? Math.PI / 2} />
        ))}
      </g>

      <g filter="url(#clio-rough)" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {model.roads.map((r) =>
          r.e.road ? (
            <g key={r.i}>
              <path d={r.d} stroke={INK} strokeWidth={5.4} opacity={0.82} />
              <path d={r.d} stroke="#e9d9ae" strokeWidth={3} />
              <path d={r.d} stroke={INK} strokeWidth={0.5} opacity={0.35} strokeDasharray="1 9" />
            </g>
          ) : (
            <path key={r.i} d={r.d} stroke={INK} strokeWidth={1.1} opacity={0.62} strokeDasharray="7 4" />
          ),
        )}
      </g>

      {model.labels.map((l) => (
        <g key={l.id}>
          <path id={l.id} d={l.d} fill="none" />
          <text className="map-italic" fontSize={13.5} fill={INK_SOFT} dy={-7} letterSpacing="1.5">
            <textPath href={'#' + l.id} startOffset="50%" textAnchor="middle">
              {l.name}
            </textPath>
          </text>
        </g>
      ))}

      {nodes.map((n) => (
        <g key={n.id}>
          {n.hq ? (
            <g transform={`translate(${n.x} ${n.y})`}>
              <circle r={8.5} fill="#eadbb3" stroke={INK} strokeWidth={1.1} />
              <path d="M0 -6l1.8 3.7l4 .5l-3 2.8l.8 4l-3.6 -2l-3.6 2l.8 -4l-3 -2.8l4 -.5z" fill={n.hq === 'union' ? '#2f4b7c' : '#8a3a30'} />
            </g>
          ) : (
            <g>
              <circle cx={n.x} cy={n.y} r={5.5} fill="#eadbb3" stroke={INK} strokeWidth={1.1} />
              <circle cx={n.x} cy={n.y} r={1.8} fill={INK} />
            </g>
          )}
          <text
            x={n.x}
            y={n.y - 60}
            textAnchor="middle"
            className={n.objective ? 'map-engraved map-place' : 'map-italic map-place'}
            fontSize={n.objective ? 19 : 16.5}
            fill={INK}
            letterSpacing={n.objective ? '1.2' : '0.3'}
          >
            {n.name}
          </text>
        </g>
      ))}

      <rect width={MAP_W} height={MAP_H} fill="url(#clio-vignette)" pointerEvents="none" />

      <g fill="none" stroke={INK}>
        <rect x={14} y={14} width={MAP_W - 28} height={MAP_H - 28} strokeWidth={3} />
        <rect x={22} y={22} width={MAP_W - 44} height={MAP_H - 44} strokeWidth={0.8} />
        <g strokeWidth={0.8}>
          {ticks.map((v) => (
            <path key={'tx' + v} d={`M${v} 14v8M${v} ${MAP_H - 14}v-8`} />
          ))}
          {ticks.filter((v) => v < MAP_H).map((v) => (
            <path key={'ty' + v} d={`M14 ${v}h8M${MAP_W - 14} ${v}h-8`} />
          ))}
        </g>
      </g>

      <Compass at={model.corners.compass} />
      <ScaleBar at={model.corners.scale} />
      <CartoucheFrame at={model.corners.cartouche} battle={battle} date={date} />
    </g>
  );
}

export const MapBase = memo(MapBaseImpl);
