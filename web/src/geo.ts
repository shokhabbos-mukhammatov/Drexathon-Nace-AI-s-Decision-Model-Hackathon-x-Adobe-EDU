import type { MapEdge, MapNode, Side, Unit } from '../../shared/types';

export type Pt = [number, number];

export const MAP_W = 1600;
export const MAP_H = 1000;

/** FNV-1a string hash, for seeding per-node decoration. */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function byId<T extends { id: string }>(list: T[] | undefined): Map<string, T> {
  const m = new Map<string, T>();
  for (const x of list ?? []) m.set(x.id, x);
  return m;
}

export function findEdge(edges: MapEdge[], a: string, b: string): MapEdge | undefined {
  return edges.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
}

/**
 * Points of an edge from `from` to the other end. Edges without `via` points get one
 * gentle, deterministic bend so no road is ruler-straight.
 */
export function edgePoints(edge: MapEdge, nodes: Map<string, MapNode>, from?: string): Pt[] {
  const a = nodes.get(edge.a);
  const b = nodes.get(edge.b);
  if (!a || !b) return [];
  let mid: Pt[] = edge.via ? edge.via.map((p) => [p[0], p[1]] as Pt) : [];
  if (mid.length === 0) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const r = rng(hash(edge.a + '>' + edge.b));
    const bend = (r() - 0.5) * 0.14 * len;
    const t = 0.4 + r() * 0.2;
    mid = [[a.x + dx * t + (-dy / len) * bend, a.y + dy * t + (dx / len) * bend]];
  }
  const pts: Pt[] = [[a.x, a.y], ...mid, [b.x, b.y]];
  return from === edge.b ? pts.reverse() : pts;
}

/** Polyline for a walk through node ids, following edges where they exist. */
export function routePoints(path: string[], nodes: Map<string, MapNode>, edges: MapEdge[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < path.length; i++) {
    const n = nodes.get(path[i]);
    if (!n) continue;
    if (i === 0) {
      out.push([n.x, n.y]);
      continue;
    }
    const e = findEdge(edges, path[i - 1], path[i]);
    const seg = e ? edgePoints(e, nodes, path[i - 1]) : [];
    if (seg.length > 1) out.push(...seg.slice(1));
    else out.push([n.x, n.y]);
  }
  return out;
}

export function polyLength(pts: Pt[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
}

export function pointAt(pts: Pt[], f: number): Pt {
  if (pts.length === 0) return [0, 0];
  if (pts.length === 1) return pts[0];
  const total = polyLength(pts);
  let want = Math.max(0, Math.min(1, f)) * total;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (want <= seg || i === pts.length - 1) {
      const t = seg === 0 ? 0 : Math.min(1, want / seg);
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
    }
    want -= seg;
  }
  return pts[pts.length - 1];
}

/** The stretch of a polyline between two fractions, including the vertices in between. */
export function sliceBetween(pts: Pt[], f0: number, f1: number): Pt[] {
  if (pts.length < 2) return pts.slice();
  const total = polyLength(pts) || 1;
  const lo = Math.max(0, Math.min(f0, f1));
  const hi = Math.min(1, Math.max(f0, f1));
  const out: Pt[] = [pointAt(pts, lo)];
  let acc = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const f = acc / total;
    if (f > lo && f < hi) out.push(pts[i]);
  }
  out.push(pointAt(pts, hi));
  return f0 <= f1 ? out : out.reverse();
}

/** Smooth SVG path through points (quadratic through midpoints). */
export function smoothPath(pts: Pt[]): string {
  if (pts.length === 0) return '';
  const f = (n: number) => n.toFixed(1);
  if (pts.length < 3) return 'M' + pts.map((p) => `${f(p[0])} ${f(p[1])}`).join(' L');
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q${f(pts[i][0])} ${f(pts[i][1])} ${f(mx)} ${f(my)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L${f(last[0])} ${f(last[1])}`;
  return d;
}

/**
 * The same curve smoothPath draws, as closely spaced points, so that anything travelling a road
 * stays on the line the road is drawn with.
 */
export function curvePoints(pts: Pt[], step = 7): Pt[] {
  if (pts.length < 3) {
    if (pts.length < 2) return pts.slice();
    const [a, b] = pts; const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    return Array.from({ length: n + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n] as Pt);
  }
  const out: Pt[] = [pts[0]];
  let from = pts[0];
  for (let i = 1; i < pts.length - 1; i++) {
    const c = pts[i]; const to: Pt = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2];
    const n = Math.max(2, Math.round((Math.hypot(c[0] - from[0], c[1] - from[1]) + Math.hypot(to[0] - c[0], to[1] - c[1])) / step));
    for (let k = 1; k <= n; k++) {
      const t = k / n; const u = 1 - t;
      out.push([u * u * from[0] + 2 * u * t * c[0] + t * t * to[0], u * u * from[1] + 2 * u * t * c[1] + t * t * to[1]]);
    }
    from = to;
  }
  const last = pts[pts.length - 1];
  const n = Math.max(1, Math.round(Math.hypot(last[0] - from[0], last[1] - from[1]) / step));
  for (let k = 1; k <= n; k++) out.push([from[0] + ((last[0] - from[0]) * k) / n, from[1] + ((last[1] - from[1]) * k) / n]);
  return out;
}

/** The road from one place to the next as it is drawn, starting at `from`. */
export function roadCurve(edges: MapEdge[], nodes: Map<string, MapNode>, from: string, to: string): Pt[] {
  const e = findEdge(edges, from, to);
  return e ? curvePoints(edgePoints(e, nodes, from)) : [];
}

export function linePath(pts: Pt[]): string {
  return pts.length ? 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L') : '';
}

export function unitWidth(u: Unit): number {
  const base = Math.sqrt(Math.max(u.strength0, 100));
  return Math.max(30, Math.min(60, 12 + base * 0.95));
}

/** One dot on the map stands for about this many men. */
export const DOT_MEN = 50;
/** Spacing between dots in a formed line, in map units. */
export const DOT_GAP = 6.6;
/** Ranks deep in line of battle. */
export const RANKS = 4;

export function dotCount(strength: number): number {
  return strength <= 0 ? 0 : Math.max(4, Math.round(strength / DOT_MEN));
}

export interface Slot {
  /** Centre of the formation. */
  x: number;
  y: number;
  side: Side;
  /** Length of the line along its front, and its depth, at full strength. */
  front: number;
  depth: number;
}

/**
 * Where each unit forms up. A line of battle runs north to south, facing the enemy across the
 * place: Confederates west of it, Union east. Units stand two to a column, further columns
 * behind the first.
 */
export function computeSlots(units: Unit[], nodes: Map<string, MapNode>): Map<string, Slot> {
  const groups = new Map<string, Unit[]>();
  for (const u of units) {
    const k = u.nodeId + '|' + u.side;
    const g = groups.get(k);
    if (g) g.push(u);
    else groups.set(k, [u]);
  }
  const slots = new Map<string, Slot>();
  const depth = RANKS * DOT_GAP;
  const frontOf = (u: Unit) => Math.ceil(dotCount(u.strength0) / RANKS) * DOT_GAP;
  for (const [k, list] of groups) {
    const nodeId = k.slice(0, k.lastIndexOf('|'));
    const n = nodes.get(nodeId);
    if (!n) continue;
    list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const dir = list[0].side === 'confederate' ? -1 : 1;
    const perCol = 2;
    const gap = 32; // room for the label under each line
    for (let c = 0; c * perCol < list.length; c++) {
      const col = list.slice(c * perCol, c * perCol + perCol);
      const total = col.reduce((a, u) => a + frontOf(u), 0) + gap * (col.length - 1);
      let y = n.y - total / 2 - 4;
      for (const u of col) {
        const front = frontOf(u);
        const x = n.x + dir * (48 + c * 74);
        slots.set(u.id, {
          x: Math.max(30, Math.min(MAP_W - 30, x)),
          y: Math.max(30 + front / 2, Math.min(MAP_H - 40 - front / 2, y + front / 2)),
          side: u.side,
          front,
          depth,
        });
        y += front + gap;
      }
    }
  }
  return slots;
}

export function fmtUsd(n: number | undefined): string {
  const v = n ?? 0;
  if (v === 0) return '$0.00';
  if (v < 0.01) return '$' + v.toFixed(5);
  if (v < 1) return '$' + v.toFixed(4);
  return '$' + v.toFixed(2);
}

export function fmtInt(n: number | undefined): string {
  return Math.round(n ?? 0).toLocaleString('en-US');
}

export function pct(p: number | undefined): string {
  const v = (p ?? 0) * 100;
  return (v >= 99.5 || v < 0.5 ? v.toFixed(0) : v.toFixed(0)) + '%';
}

export function addMinutes(clock: string, minutes: number): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(clock ?? '');
  if (!m) return clock ?? '';
  const total = (((parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + minutes) % 1440) + 1440) % 1440;
  return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
}

export function clockMinutes(clock: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(clock ?? '');
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}

/** "16:30" -> "4:30 PM". */
export function clock12(clock: string | undefined): string {
  const mins = clockMinutes(clock ?? '');
  if (mins === null) return clock ?? '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
