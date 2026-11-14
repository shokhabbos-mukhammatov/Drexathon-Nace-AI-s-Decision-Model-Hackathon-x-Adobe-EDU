import { memo, useEffect, useRef } from 'react';
import type { MapEdge, MapNode, Side, Unit } from '../../../shared/types';
import { DOT_GAP, MAP_H, MAP_W, RANKS, type Pt, type Slot, dotCount, edgePoints, findEdge, pointAt, polyLength } from '../geo';

// The troops themselves. Each dot is about fifty men.
//
// Men move at a marching pace to an exact place in a formation; nothing eases or drifts.
//  - On the road a brigade is a column of fours that follows the bends of the road, each rank
//    stepping off in turn and filing into line as it arrives.
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
}

interface Dot { x: number; y: number; k: number }
interface March { pts: Pt[]; len: number; t0: number; dur: number; flee: boolean }
interface Sim {
  dots: Dot[];
  nodeId: string;
  side: Side;
  march?: March;
  /** Men still to fall from the last report of losses, and the clock that spaces them out. */
  owed: number;
  every: number;
  since: number;
}
interface Fallen { x: number; y: number; side: Side; t: number; a: number }
interface Puff { x: number; y: number; vx: number; vy: number; t: number; life: number }
interface Flash { x: number; y: number; t: number }

const PACE = 62; // map units a second on the road
const COL_GAP = 4.7; // spacing in column, along and across
const ABREAST = 4;
const LOSS_WINDOW = 3.2; // seconds over which a half hour's losses fall

/** How long a column of this many men takes to file down a road of this length and form up. */
export function marchSeconds(len: number, men: number): number {
  const tail = Math.floor((dotCount(men) - 1) / ABREAST) * COL_GAP;
  return Math.max(1.6, Math.min(4.6, (len + tail) / PACE));
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

    const fall = (sim: Sim, i: number, now: number) => {
      const [d] = sim.dots.splice(i, 1);
      if (d) fallen.push({ x: d.x, y: d.y, side: sim.side, t: now, a: d.k * Math.PI });
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const { units, slots, nodes, edges, contested, selectedId, hoveredId } = latest.current;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, MAP_W, MAP_H);

      // The fallen lie where they fell.
      fallen = fallen.filter((f) => now - f.t < 90_000);
      if (fallen.length > 700) fallen.splice(0, fallen.length - 700);
      for (const f of fallen) {
        const age = now - f.t;
        ctx.globalAlpha = 0.62 * (1 - age / 90_000);
        ctx.strokeStyle = f.side === 'union' ? '#1b2c4a' : '#43302a';
        ctx.lineWidth = 1.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(f.x - Math.cos(f.a) * 2, f.y - Math.sin(f.a) * 2); ctx.lineTo(f.x + Math.cos(f.a) * 2, f.y + Math.sin(f.a) * 2); ctx.stroke();
        if (age < 650) {
          // the moment he is hit
          const p = age / 650;
          ctx.globalAlpha = 0.9 * (1 - p);
          ctx.fillStyle = '#b3261e'; ctx.beginPath(); ctx.arc(f.x, f.y, 2.2 + p * 3.2, 0, 7); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      const seen = new Set<string>();
      const bodies: { u: Unit; sim: Sim; slot: Slot; reserve: boolean; broken: boolean }[] = [];

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

        // Ordered to another place: take the road. A routed unit does not march, it runs.
        if (sim.nodeId !== u.nodeId) {
          const e = findEdge(edges, sim.nodeId, u.nodeId);
          const n0 = sim.dots.length || 1;
          const from: Pt = [sim.dots.reduce((a, d) => a + d.x, 0) / n0, sim.dots.reduce((a, d) => a + d.y, 0) / n0];
          const road = e ? edgePoints(e, nodes, sim.nodeId) : [];
          const pts: Pt[] = [from, ...road.slice(1, -1), [slot.x, slot.y]];
          const len = Math.max(1, polyLength(pts));
          sim.march = reduce ? undefined : { pts, len, t0: now, dur: marchSeconds(len, u.strength) * 1000, flee: broken };
          sim.nodeId = u.nodeId;
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
            // the front rank takes most of it
            const i = sim.march ? Math.floor(Math.random() * n) : Math.min(n - 1, Math.floor(Math.random() * files) * RANKS + (Math.random() < 0.3 ? 1 : 0));
            fall(sim, i, now); sim.owed--;
          }
        }
        while (sim.dots.length < want) { const [x, y] = lineSpot(slot, sim.dots.length, want); sim.dots.push({ x, y, k: Math.random() }); }

        const n = sim.dots.length;
        const m = sim.march;
        const elapsed = m ? (now - m.t0) / 1000 : 0;
        if (m && now - m.t0 > m.dur + 900) sim.march = undefined;
        const ranksInColumn = Math.ceil(n / ABREAST);
        const head = m ? ((now - m.t0) / m.dur) * (m.len + (ranksInColumn - 1) * COL_GAP) : 0;
        const step = (reduce ? 1e6 : m?.flee ? PACE * 1.9 : PACE * 1.7) * dt;

        for (let i = 0; i < n; i++) {
          const d = sim.dots[i];
          let tx = d.x; let ty = d.y;
          if (m && m.flee) {
            // Every man for himself, at his own speed, strung out along the road and off it.
            const s = Math.min(m.len, elapsed * PACE * (1.1 + d.k * 0.9));
            const [px, py] = pointAt(m.pts, s / m.len);
            const a = d.k * 61; const r = 4 + ((d.k * 13.7) % 1) * (s >= m.len ? 26 : 12);
            tx = px + Math.cos(a) * r; ty = py + Math.sin(a) * r;
          } else if (m) {
            const along = head - Math.floor(i / ABREAST) * COL_GAP;
            if (along >= m.len) [tx, ty] = lineSpot(slot, i, n); // arrived: file into line
            else if (along > 0) {
              const g = along / m.len;
              const [px, py] = pointAt(m.pts, g);
              const [qx, qy] = pointAt(m.pts, Math.min(1, g + 0.015));
              const [bx, by] = pointAt(m.pts, Math.max(0, g - 0.015));
              const hx = qx - bx; const hy = qy - by; const hl = Math.hypot(hx, hy) || 1;
              const off = ((i % ABREAST) - (ABREAST - 1) / 2) * COL_GAP;
              tx = px + (-hy / hl) * off; ty = py + (hx / hl) * off;
            } // else: not yet his rank's turn to step off; he stands where he is
          } else if (broken) {
            const a = d.k * 61; const r = 4 + ((d.k * 13.7) % 1) * 26;
            tx = slot.x + Math.cos(a) * r; ty = slot.y + Math.sin(a) * r;
          } else {
            [tx, ty] = lineSpot(slot, i, n);
            if (shaken) {
              // The line wavers, and some men hang back from it.
              const back = -toward(u.side);
              const file = Math.floor(i / RANKS);
              tx += Math.sin(now / 900 + file * 0.9) * 1.6 + (d.k > 0.82 ? back * (5 + d.k * 9) : 0);
              ty += Math.cos(d.k * 31) * 1.4;
            }
          }
          const dx = tx - d.x; const dy = ty - d.y; const dist = Math.hypot(dx, dy);
          if (dist <= step) { d.x = tx; d.y = ty; }
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
            flashes.push({ x: d.x + t * 4, y: d.y, t: now });
            puffs.push({ x: d.x + t * 5.5, y: d.y, vx: t * (5 + Math.random() * 9), vy: -3 - Math.random() * 7, t: now, life: 1300 + Math.random() * 1100 });
          }
        }
        bodies.push({ u, sim, slot, reserve, broken });
      }
      for (const id of sims.keys()) if (!seen.has(id)) sims.delete(id);

      for (const { u, sim, reserve, broken } of bodies) {
        const n = sim.dots.length;
        if (!n) continue;
        // A ring only for the unit under the pointer or selected.
        if (u.id === selectedId || u.id === hoveredId) {
          let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
          for (const d of sim.dots) { x0 = Math.min(x0, d.x); x1 = Math.max(x1, d.x); y0 = Math.min(y0, d.y); y1 = Math.max(y1, d.y); }
          ctx.strokeStyle = '#a8843a'; ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]);
          ctx.beginPath(); ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2 + 12, (y1 - y0) / 2 + 12, 0, 0, 7); ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.globalAlpha = broken ? 0.7 : u.status === 'spent' ? 0.8 : 1;
        // marching cadence: alternate ranks rock a little as they step
        const stepping = !!sim.march && !sim.march.flee && !reduce;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const d = sim.dots[i];
          const bob = stepping ? Math.sin(now / 95 + Math.floor(i / ABREAST) * Math.PI) * 0.45 : 0;
          ctx.moveTo(d.x + 2.1, d.y + bob); ctx.arc(d.x, d.y + bob, reserve ? 1.8 : 2.1, 0, 7);
        }
        if (reserve) { ctx.strokeStyle = DOT[u.side]; ctx.lineWidth = 0.9; ctx.stroke(); }
        else { ctx.fillStyle = DOT[u.side]; ctx.fill(); ctx.strokeStyle = EDGE[u.side]; ctx.lineWidth = 0.45; ctx.stroke(); }
        // The colours: at the head of a column, in the centre of a line. A routed unit has lost them.
        if (!broken && n > 3) {
          const c = sim.dots[sim.march ? 0 : Math.floor(n / 2)];
          const wave = reduce ? 0 : Math.sin(now / 260 + c.k * 9) * 0.8;
          ctx.strokeStyle = '#2b2118'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x, c.y - 13); ctx.stroke();
          ctx.fillStyle = FLAG[u.side];
          ctx.beginPath(); ctx.moveTo(c.x, c.y - 13); ctx.lineTo(c.x + 9, c.y - 10.6 + wave); ctx.lineTo(c.x, c.y - 7.6); ctx.closePath(); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // Musketry: the flash, then the smoke rolling toward the enemy and lifting.
      flashes = flashes.filter((f) => now - f.t < 110);
      ctx.fillStyle = '#f4b63a';
      for (const f of flashes) { ctx.globalAlpha = 1 - (now - f.t) / 110; ctx.beginPath(); ctx.arc(f.x, f.y, 2.4, 0, 7); ctx.fill(); }
      puffs = puffs.filter((p) => now - p.t < p.life);
      if (puffs.length > 500) puffs.splice(0, puffs.length - 500);
      ctx.fillStyle = '#f7f2e6';
      for (const p of puffs) {
        const a = (now - p.t) / p.life;
        p.x += p.vx * dt * (1 - a); p.y += p.vy * dt;
        ctx.globalAlpha = 0.5 * (1 - a) * Math.min(1, a * 8);
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.4 + a * 6.5, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={canvasRef} className="troop-canvas" aria-hidden="true" />;
}

export const TroopCanvas = memo(TroopCanvasImpl);
