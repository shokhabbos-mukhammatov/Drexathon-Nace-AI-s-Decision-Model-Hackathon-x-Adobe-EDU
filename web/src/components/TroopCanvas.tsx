import { memo, useEffect, useRef } from 'react';
import type { MapEdge, MapNode, Side, Unit } from '../../../shared/types';
import { DOT_GAP, MAP_H, MAP_W, RANKS, type Pt, type Slot, dotCount, findEdge, pointAt, polyLength, roadCurve } from '../geo';

// The troops themselves. Each dot is about fifty men.
//
// Men move at a marching pace to an exact place in a formation; nothing eases or drifts.
//  - On the road a brigade is a column of fours that keeps to the road as it is drawn. How far
//    it gets in a half hour is decided by the ground (the engine works that out), so a column
//    is often still on the road when the half hour ends, and it halts there until the next.
//  - In position it is a line of battle four ranks deep, facing the enemy.
//  - Under fire the line holds only as well as its morale: a shaken line wavers and sheds men to
//    the rear, a routed one dissolves and every man runs for himself.
//  - Losses are paid out one man at a time across the half hour, so you see each one fall.
// Nothing encloses a formation: it is free to break. Hovering or selecting a unit rings it.

interface Props {
  units: Unit[];
  slots: Map<string, Slot>;
  nodes: Map<string, MapNode>;
  edges: MapEdge[];
  contested: Set<string>;
  selectedId: string | null;
  hoveredId: string | null;
  /** The window of the map on screen (see useMapView). */
  view?: { x: number; y: number; k: number };
}

interface Dot { x: number; y: number; k: number }
interface March {
  /** Which road: "from>to". */
  key: string;
  pts: Pt[];
  len: number;
  /** Distance of the head of the column along the road: where it was, and where it is bound this half hour. */
  from: number;
  to: number;
  t0: number;
  dur: number;
  /** True once the column is ordered into its place in line at the far end. */
  arrive: boolean;
  flee: boolean;
}
interface Sim {
  dots: Dot[];
  nodeId: string;
  side: Side;
  march?: March;
  owed: number;
  every: number;
  since: number;
}
interface Fallen { x: number; y: number; side: Side; t: number; a: number }
interface Puff { x: number; y: number; vx: number; vy: number; t: number; life: number }
interface Flash { x: number; y: number; t: number }

const PACE = 58; // map units a second on the road
const COL_GAP = 6.3; // spacing in column, along and across
const ABREAST = 4;
const R = 2.9; // radius of a man
const LOSS_WINDOW = 3.2; // seconds over which a half hour's losses fall

const tailOf = (men: number) => Math.floor((dotCount(men) - 1) / ABREAST) * COL_GAP;
const secondsFor = (dist: number) => Math.max(0.9, Math.min(4.8, dist / PACE));

/** How long a column of this many men takes to cover this much road and form up. */
export function marchSeconds(len: number, men: number): number {
  return secondsFor(len + tailOf(men));
}

const DOT = { union: '#24427a', confederate: '#5b5650' } as const;
const EDGE = { union: '#101d33', confederate: '#2c2622' } as const;
const FLAG = { union: '#1f3a6b', confederate: '#a23a2e' } as const;

function TroopCanvasImpl(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    const sims = new Map<string, Sim>();
    let fallen: Fallen[] = [];
    let puffs: Puff[] = [];
    let flashes: Flash[] = [];
    let scale = 1;
    let raf = 0;
    let last = performance.now();

    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth; const h = canvas.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      scale = canvas.width / MAP_W;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);

    const toward = (side: Side) => (side === 'confederate' ? 1 : -1); // toward the enemy across the place

    /** Place of man i of n in line of battle at the slot. */
    const lineSpot = (slot: Slot, i: number, n: number): Pt => {
      const files = Math.ceil(n / RANKS);
      const file = Math.floor(i / RANKS); const rank = i % RANKS;
      return [slot.x + toward(slot.side) * ((RANKS - 1) / 2 - rank) * DOT_GAP, slot.y + (file - (files - 1) / 2) * DOT_GAP];
    };
    const centre = (sim: Sim, slot: Slot): Pt => {
      const n = sim.dots.length;
      return n ? [sim.dots.reduce((a, d) => a + d.x, 0) / n, sim.dots.reduce((a, d) => a + d.y, 0) / n] : [slot.x, slot.y];
    };
    const headNow = (m: March, now: number) => m.from + (m.to - m.from) * Math.max(0, Math.min(1, (now - m.t0) / m.dur));

    const fall = (sim: Sim, i: number, now: number) => {
      const [d] = sim.dots.splice(i, 1);
      if (d) fallen.push({ x: d.x, y: d.y, side: sim.side, t: now, a: d.k * Math.PI });
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      // The first frame's timestamp can precede the moment the loop was started, so never go negative.
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
      const { units, slots, nodes, edges, contested, selectedId, hoveredId, view } = latest.current;
      // Draw through the same window as the SVG layers, so soldiers stay sharp when zoomed in.
      const zk = view?.k ?? 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale * zk, 0, 0, scale * zk, -(view?.x ?? 0) * scale * zk, -(view?.y ?? 0) * scale * zk);

      // The fallen lie where they fell.
      fallen = fallen.filter((f) => now - f.t < 90_000);
      if (fallen.length > 700) fallen.splice(0, fallen.length - 700);
      for (const f of fallen) {
        const age = now - f.t;
        ctx.globalAlpha = 0.62 * (1 - age / 90_000);
        ctx.strokeStyle = f.side === 'union' ? '#1b2c4a' : '#43302a';
        ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(f.x - Math.cos(f.a) * 2.7, f.y - Math.sin(f.a) * 2.7); ctx.lineTo(f.x + Math.cos(f.a) * 2.7, f.y + Math.sin(f.a) * 2.7); ctx.stroke();
        if (age < 650) {
          const p = age / 650; // the moment he is hit
          ctx.globalAlpha = 0.9 * (1 - p);
          ctx.fillStyle = '#b3261e'; ctx.beginPath(); ctx.arc(f.x, f.y, 3 + p * 4.2, 0, 7); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      const seen = new Set<string>();
      const bodies: { u: Unit; sim: Sim; reserve: boolean; broken: boolean }[] = [];

      for (const u of units) {
        const slot = slots.get(u.id);
        if (!slot || u.strength <= 0) continue;
        seen.add(u.id);
        const want = dotCount(u.strength);
        let sim = sims.get(u.id);
        if (!sim) {
          sim = { dots: [], nodeId: u.nodeId, side: u.side, owed: 0, every: 0, since: 0 };
          for (let i = 0; i < want; i++) { const [x, y] = lineSpot(slot, i, want); sim.dots.push({ x, y, k: Math.random() }); }
          sims.set(u.id, sim);
        }
        const reserve = !!u.inReserve || u.status === 'reserve';
        const broken = u.status === 'routed';
        const inFight = !reserve && !broken && (u.status === 'engaged' || contested.has(u.nodeId));
        const shaken = !broken && (u.status === 'shaken' || u.status === 'spent' || u.morale < 40);
        const tail = tailOf(u.strength);

        if (sim.nodeId !== u.nodeId) {
          // It has reached another place (or been driven to one).
          const key = `${sim.nodeId}>${u.nodeId}`;
          const m = sim.march;
          if (m && m.key === key && !broken) {
            // Already on this road: finish the march and form up.
            m.from = headNow(m, now); m.pts = [...m.pts.slice(0, -1), [slot.x, slot.y]]; m.len = Math.max(1, polyLength(m.pts));
            m.to = m.len + tail; m.t0 = now; m.dur = secondsFor(m.to - m.from) * 1000; m.arrive = true;
          } else if (!findEdge(edges, sim.nodeId, u.nodeId) || reduce) {
            // No road between the two places: a new battle being set up, not a march.
            sim.march = undefined;
            sim.dots.forEach((d, i) => { [d.x, d.y] = lineSpot(slot, i, sim!.dots.length); });
          } else {
            const road = roadCurve(edges, nodes, sim.nodeId, u.nodeId);
            const pts: Pt[] = [centre(sim, slot), ...road.slice(1, -1), [slot.x, slot.y]];
            const len = Math.max(1, polyLength(pts));
            sim.march = { key, pts, len, from: 0, to: len + tail, t0: now, dur: secondsFor(len + tail) * 1000, arrive: true, flee: broken };
          }
          sim.nodeId = u.nodeId;
        } else if (u.moving && !reduce) {
          // Still on the road at the end of the half hour: advance to where the ground let it get.
          const key = `${u.nodeId}>${u.moving.to}`;
          const m = sim.march;
          if (!m || m.key !== key || m.arrive) {
            const road = roadCurve(edges, nodes, u.nodeId, u.moving.to);
            if (road.length > 1) {
              const pts: Pt[] = [centre(sim, slot), ...road.slice(1)];
              const len = Math.max(1, polyLength(pts));
              const to = u.moving.progress * len;
              sim.march = { key, pts, len, from: 0, to, t0: now, dur: secondsFor(to) * 1000, arrive: false, flee: false };
            }
          } else {
            const to = u.moving.progress * m.len;
            if (to > m.to + 0.5) { m.from = headNow(m, now); m.to = to; m.t0 = now; m.dur = secondsFor(m.to - m.from) * 1000; }
          }
        } else if (sim.march && !sim.march.arrive) {
          sim.march = undefined; // halted and recalled: back into line where it stands
        }

        // Losses reported for the half hour are paid out a man at a time.
        const excess = sim.dots.length - want;
        if (excess > sim.owed) { sim.owed = excess; sim.every = LOSS_WINDOW / excess; }
        if (excess <= 0) sim.owed = 0;
        if (sim.owed > 0) {
          sim.since += dt;
          while (sim.owed > 0 && (reduce || sim.since >= sim.every) && sim.dots.length > want) {
            sim.since -= sim.every;
            const n = sim.dots.length; const files = Math.ceil(n / RANKS);
            const i = sim.march ? Math.floor(Math.random() * n) : Math.min(n - 1, Math.floor(Math.random() * files) * RANKS + (Math.random() < 0.3 ? 1 : 0));
            fall(sim, i, now); sim.owed--;
          }
        }
        while (sim.dots.length < want) { const [x, y] = lineSpot(slot, sim.dots.length, want); sim.dots.push({ x, y, k: Math.random() }); }

        const n = sim.dots.length;
        const m = sim.march;
        if (m && m.arrive && now - m.t0 > m.dur + 1200) sim.march = undefined;
        const head = m ? headNow(m, now) : 0;
        const elapsed = m ? (now - m.t0) / 1000 : 0;
        const step = (reduce ? 1e6 : m?.flee ? PACE * 1.9 : PACE * 1.7) * dt;

        for (let i = 0; i < n; i++) {
          const d = sim.dots[i];
          let tx = d.x; let ty = d.y;
          if (m && m.flee) {
            // Every man for himself, at his own speed, strung out along the road and off it.
            const s = Math.min(m.len, elapsed * PACE * (1.1 + d.k * 0.9));
            const [px, py] = pointAt(m.pts, s / m.len);
            const a = d.k * 61; const r = 5 + ((d.k * 13.7) % 1) * (s >= m.len ? 34 : 15);
            tx = px + Math.cos(a) * r; ty = py + Math.sin(a) * r;
          } else if (m) {
            const along = head - Math.floor(i / ABREAST) * COL_GAP;
            if (m.arrive && along >= m.len) [tx, ty] = lineSpot(slot, i, n); // arrived: file into line
            else if (along > 0) {
              const g = Math.min(1, along / m.len);
              const [px, py] = pointAt(m.pts, g);
              const [qx, qy] = pointAt(m.pts, Math.min(1, g + 0.012));
              const [bx, by] = pointAt(m.pts, Math.max(0, g - 0.012));
              const hx = qx - bx; const hy = qy - by; const hl = Math.hypot(hx, hy) || 1;
              const off = ((i % ABREAST) - (ABREAST - 1) / 2) * COL_GAP;
              tx = px + (-hy / hl) * off; ty = py + (hx / hl) * off;
            } // else: not yet his rank's turn to step off; he stands where he is
          } else if (broken) {
            const a = d.k * 61; const r = 5 + ((d.k * 13.7) % 1) * 34;
            tx = slot.x + Math.cos(a) * r; ty = slot.y + Math.sin(a) * r;
          } else {
            [tx, ty] = lineSpot(slot, i, n);
            if (shaken) {
              // The line wavers, and some men hang back from it.
              const back = -toward(u.side);
              const file = Math.floor(i / RANKS);
              tx += Math.sin(now / 900 + file * 0.9) * 2.1 + (d.k > 0.82 ? back * (7 + d.k * 12) : 0);
              ty += Math.cos(d.k * 31) * 1.8;
            }
          }
          const dx = tx - d.x; const dy = ty - d.y; const dist = Math.hypot(dx, dy);
          if (dist <= step || dist < 1e-6 || !Number.isFinite(d.x + d.y)) { d.x = tx; d.y = ty; }
          else { d.x += (dx / dist) * step; d.y += (dy / dist) * step; }
        }

        // Fire by files from the front rank.
        if (inFight && !reduce && !sim.march && u.ammo > 0 && n > 0) {
          const files = Math.ceil(n / RANKS);
          const rate = files * 0.5 * (u.ammo > 15 ? 1 : 0.35);
          let shots = Math.random() < rate * dt ? 1 : 0;
          if (rate * dt > 0.5 && Math.random() < 0.5) shots++;
          const t = toward(u.side);
          while (shots-- > 0) {
            const d = sim.dots[Math.min(n - 1, Math.floor(Math.random() * files) * RANKS)];
            flashes.push({ x: d.x + t * 5, y: d.y, t: now });
            puffs.push({ x: d.x + t * 7, y: d.y, vx: t * (6 + Math.random() * 11), vy: -3 - Math.random() * 8, t: now, life: 1300 + Math.random() * 1100 });
          }
        }
        bodies.push({ u, sim, reserve, broken });
      }
      for (const id of sims.keys()) if (!seen.has(id)) sims.delete(id);

      for (const { u, sim, reserve, broken } of bodies) {
        const n = sim.dots.length;
        if (!n) continue;
        // A ring only for the unit under the pointer or selected.
        if (u.id === selectedId || u.id === hoveredId) {
          let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
          for (const d of sim.dots) { x0 = Math.min(x0, d.x); x1 = Math.max(x1, d.x); y0 = Math.min(y0, d.y); y1 = Math.max(y1, d.y); }
          ctx.strokeStyle = '#a8843a'; ctx.lineWidth = 1.8; ctx.setLineDash([6, 4]);
          ctx.beginPath(); ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2 + 14, (y1 - y0) / 2 + 14, 0, 0, 7); ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.globalAlpha = broken ? 0.7 : u.status === 'spent' ? 0.8 : 1;
        // marching cadence: alternate ranks rock a little as they step, only while the column is moving
        const m = sim.march;
        const stepping = !!m && !m.flee && !reduce && now - m.t0 < m.dur;
        const r = reserve ? R - 0.4 : R;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const d = sim.dots[i];
          const bob = stepping ? Math.sin(now / 95 + Math.floor(i / ABREAST) * Math.PI) * 0.6 : 0;
          ctx.moveTo(d.x + r, d.y + bob); ctx.arc(d.x, d.y + bob, r, 0, 7);
        }
        if (reserve) { ctx.strokeStyle = DOT[u.side]; ctx.lineWidth = 1.1; ctx.stroke(); }
        else { ctx.fillStyle = DOT[u.side]; ctx.fill(); ctx.strokeStyle = EDGE[u.side]; ctx.lineWidth = 0.55; ctx.stroke(); }
        // The colours: at the head of a column, in the centre of a line. A routed unit has lost them.
        if (!broken && n > 3) {
          const c = sim.dots[m ? 0 : Math.floor(n / 2)];
          const wave = reduce ? 0 : Math.sin(now / 260 + c.k * 9) * 1;
          ctx.strokeStyle = '#2b2118'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x, c.y - 18); ctx.stroke();
          ctx.fillStyle = FLAG[u.side];
          ctx.beginPath(); ctx.moveTo(c.x, c.y - 18); ctx.lineTo(c.x + 12.5, c.y - 14.6 + wave); ctx.lineTo(c.x, c.y - 10.4); ctx.closePath(); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // Musketry: the flash, then the smoke rolling toward the enemy and lifting.
      flashes = flashes.filter((f) => now - f.t < 110);
      ctx.fillStyle = '#f4b63a';
      for (const f of flashes) { ctx.globalAlpha = 1 - (now - f.t) / 110; ctx.beginPath(); ctx.arc(f.x, f.y, 3.2, 0, 7); ctx.fill(); }
      puffs = puffs.filter((p) => now - p.t < p.life);
      if (puffs.length > 500) puffs.splice(0, puffs.length - 500);
      ctx.fillStyle = '#f7f2e6';
      for (const p of puffs) {
        const a = (now - p.t) / p.life;
        p.x += p.vx * dt * (1 - a); p.y += p.vy * dt;
        ctx.globalAlpha = 0.5 * (1 - a) * Math.min(1, a * 8);
        ctx.beginPath(); ctx.arc(p.x, p.y, 3 + a * 8, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={canvasRef} className="troop-canvas" aria-hidden="true" />;
}

export const TroopCanvas = memo(TroopCanvasImpl);
