import { memo, useEffect, useRef } from 'react';
import type { MapEdge, MapNode, Side, Unit } from '../../../shared/types';
import { DOT_GAP, MAP_H, MAP_W, RANKS, type Pt, type Slot, dotCount, edgePoints, findEdge, pointAt, polyLength } from '../geo';

// The troops themselves. Each dot is about fifty men. A brigade marches in column along the
// road, forms line facing the enemy, fires by files, and loses dots where it loses men. Every
// formation is enclosed in an outline so it reads as one body. Drawn on a canvas because there
// are hundreds of dots in motion; the labels and hit areas stay in the SVG layer above.

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
interface Sim {
  dots: Dot[];
  nodeId: string;
  side: Side;
  march?: { pts: Pt[]; len: number; t0: number; dur: number };
}
interface Fallen { x: number; y: number; side: Side; t: number }
interface Puff { x: number; y: number; vx: number; vy: number; t: number; life: number }
interface Flash { x: number; y: number; t: number }

export const MARCH_MS = 1900;

const DOT = { union: '#24427a', confederate: '#5b5650' } as const;
const RING = { union: '#16263f', confederate: '#7d2f27' } as const;
const TINT = { union: 'rgba(47, 75, 124, 0.16)', confederate: 'rgba(125, 47, 39, 0.13)' } as const;
const FLAG = { union: '#1f3a6b', confederate: '#a23a2e' } as const;

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function hull(points: Pt[]): Pt[] {
  if (points.length < 3) return points.slice();
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt[] = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  const upper: Pt[] = [];
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

const RING_PTS: Pt[] = Array.from({ length: 10 }, (_, i) => [Math.cos((i / 10) * Math.PI * 2), Math.sin((i / 10) * Math.PI * 2)] as Pt);

/** The outline of a body of dots: their hull, pushed out by `pad` with rounded corners. */
function enclosure(dots: Dot[], pad: number): Pt[] {
  if (!dots.length) return [];
  const core = hull(dots.map((d) => [d.x, d.y] as Pt));
  const grown: Pt[] = [];
  for (const [x, y] of core) for (const [cx, cy] of RING_PTS) grown.push([x + cx * pad, y + cy * pad]);
  return hull(grown);
}

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

    /** Where dot i of n stands when the body is formed in line at its slot. */
    const lineSpot = (slot: Slot, i: number, n: number): Pt => {
      const files = Math.ceil(n / RANKS);
      const file = Math.floor(i / RANKS); const rank = i % RANKS;
      const toward = slot.side === 'confederate' ? 1 : -1; // toward the enemy across the place
      return [slot.x + toward * ((RANKS - 1) / 2 - rank) * DOT_GAP, slot.y + (file - (files - 1) / 2) * DOT_GAP];
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const { units, slots, nodes, edges, contested, selectedId, hoveredId } = latest.current;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, MAP_W, MAP_H);

      // The fallen stay where they fell and fade over a minute.
      fallen = fallen.filter((f) => now - f.t < 60_000);
      if (fallen.length > 900) fallen.splice(0, fallen.length - 900);
      for (const f of fallen) {
        const age = (now - f.t) / 60_000;
        ctx.globalAlpha = 0.55 * (1 - age);
        ctx.fillStyle = f.side === 'union' ? '#1b2c4a' : '#4a2a22';
        ctx.fillRect(f.x - 2.1, f.y - 0.8, 4.2, 1.6);
        if (now - f.t < 500) { ctx.globalAlpha = 0.8 * (1 - (now - f.t) / 500); ctx.fillStyle = '#b3261e'; ctx.beginPath(); ctx.arc(f.x, f.y, 3.4, 0, 7); ctx.fill(); }
      }
      ctx.globalAlpha = 1;

      const seen = new Set<string>();
      const bodies: { u: Unit; sim: Sim; reserve: boolean; broken: boolean; engaged: boolean }[] = [];

      for (const u of units) {
        const slot = slots.get(u.id);
        if (!slot || u.strength <= 0) continue;
        seen.add(u.id);
        const want = dotCount(u.strength);
        let sim = sims.get(u.id);
        if (!sim) {
          sim = { dots: [], nodeId: u.nodeId, side: u.side };
          for (let i = 0; i < want; i++) { const [x, y] = lineSpot(slot, i, want); sim.dots.push({ x, y, k: Math.random() }); }
          sims.set(u.id, sim);
        }
        const reserve = !!u.inReserve || u.status === 'reserve';
        const broken = u.status === 'routed';
        const engaged = !reserve && !broken && (u.status === 'engaged' || contested.has(u.nodeId));

        // A move to another place: fall into column and take the road.
        if (sim.nodeId !== u.nodeId) {
          const e = findEdge(edges, sim.nodeId, u.nodeId);
          const from: Pt = sim.dots.length ? [sim.dots.reduce((a, d) => a + d.x, 0) / sim.dots.length, sim.dots.reduce((a, d) => a + d.y, 0) / sim.dots.length] : [slot.x, slot.y];
          const road = e ? edgePoints(e, nodes, sim.nodeId) : [];
          const pts: Pt[] = [from, ...road.slice(1, -1), [slot.x, slot.y]];
          sim.march = reduce ? undefined : { pts, len: Math.max(1, polyLength(pts)), t0: now, dur: MARCH_MS };
          sim.nodeId = u.nodeId;
        }

        // Losses: men fall out of the front ranks and stay on the ground.
        while (sim.dots.length > want) {
          const files = Math.ceil(sim.dots.length / RANKS);
          const i = Math.min(sim.dots.length - 1, Math.floor(Math.random() * files) * RANKS + (Math.random() < 0.3 ? 1 : 0));
          const [d] = sim.dots.splice(i, 1);
          fallen.push({ x: d.x + (Math.random() - 0.5) * 2, y: d.y + (Math.random() - 0.5) * 2, side: u.side, t: now });
        }
        while (sim.dots.length < want) { const [x, y] = lineSpot(slot, sim.dots.length, want); sim.dots.push({ x, y, k: Math.random() }); }

        // Where each man is trying to be.
        const n = sim.dots.length;
        const m = sim.march;
        const f = m ? Math.min(1, (now - m.t0) / m.dur) : 1;
        if (m && f >= 1) sim.march = undefined;
        const pull = 1 - Math.exp(-dt * (m ? 9 : 5));
        for (let i = 0; i < n; i++) {
          const d = sim.dots[i];
          let tx: number; let ty: number;
          if (m && f < 1) {
            // Column of threes strung back along the road behind the head of the column.
            const along = ease(f) * (m.len + Math.floor((n - 1) / 3) * 5.2) - Math.floor(i / 3) * 5.2;
            const g = Math.max(0, Math.min(1, along / m.len));
            const [px, py] = pointAt(m.pts, g);
            const [qx, qy] = pointAt(m.pts, Math.min(1, g + 0.02));
            const len = Math.hypot(qx - px, qy - py) || 1;
            const off = ((i % 3) - 1) * 4.3;
            tx = px + (-(qy - py) / len) * off; ty = py + ((qx - px) / len) * off;
          } else if (broken) {
            const a = d.k * 50; const r = (9 + Math.sqrt(n) * 4.2) * Math.sqrt((d.k * 7.13) % 1);
            tx = slot.x + Math.cos(a) * r; ty = slot.y + Math.sin(a) * r;
          } else {
            [tx, ty] = lineSpot(slot, i, n);
            if (u.status === 'spent' || u.status === 'shaken') { tx += Math.sin(d.k * 40) * 1.7; ty += Math.cos(d.k * 31) * 1.7; }
          }
          if (reduce) { d.x = tx; d.y = ty; }
          else {
            d.x += (tx - d.x) * pull; d.y += (ty - d.y) * pull;
            if (engaged) { d.x += (Math.random() - 0.5) * 0.55; d.y += (Math.random() - 0.5) * 0.55; }
          }
        }

        // Fire by files from the front rank.
        if (engaged && !reduce && !sim.march && u.ammo > 0 && n > 0) {
          const files = Math.ceil(n / RANKS);
          const rate = files * 0.55 * (u.ammo > 15 ? 1 : 0.35);
          let shots = Math.random() < rate * dt ? 1 : 0;
          if (rate * dt > 0.5 && Math.random() < 0.5) shots++;
          const toward = u.side === 'confederate' ? 1 : -1;
          while (shots-- > 0) {
            const d = sim.dots[Math.min(n - 1, Math.floor(Math.random() * files) * RANKS)];
            flashes.push({ x: d.x + toward * 4, y: d.y, t: now });
            puffs.push({ x: d.x + toward * 5.5, y: d.y, vx: toward * (5 + Math.random() * 9), vy: -3 - Math.random() * 7, t: now, life: 1300 + Math.random() * 1100 });
          }
        }
        bodies.push({ u, sim, reserve, broken, engaged });
      }
      for (const id of sims.keys()) if (!seen.has(id)) sims.delete(id);

      // Enclosures first, then the men on top.
      ctx.lineJoin = 'round';
      for (const { u, sim, reserve, broken, engaged } of bodies) {
        const shape = enclosure(sim.dots, 7);
        if (shape.length < 3) continue;
        ctx.beginPath();
        shape.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
        ctx.fillStyle = reserve ? 'rgba(233, 219, 178, 0.55)' : TINT[u.side];
        ctx.globalAlpha = broken ? 0.5 : 1;
        ctx.fill();
        const picked = u.id === selectedId || u.id === hoveredId;
        ctx.setLineDash(reserve ? [4, 3] : broken ? [1.5, 3] : []);
        ctx.strokeStyle = picked ? '#a8843a' : RING[u.side];
        ctx.lineWidth = picked ? 2.6 : engaged ? 2 : 1.4;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
      for (const { u, sim, reserve, broken } of bodies) {
        ctx.globalAlpha = broken ? 0.6 : u.status === 'spent' ? 0.75 : 1;
        if (reserve) {
          ctx.strokeStyle = DOT[u.side]; ctx.lineWidth = 0.9;
          ctx.beginPath();
          for (const d of sim.dots) { ctx.moveTo(d.x + 1.8, d.y); ctx.arc(d.x, d.y, 1.8, 0, 7); }
          ctx.stroke();
        } else {
          ctx.fillStyle = DOT[u.side];
          ctx.beginPath();
          for (const d of sim.dots) { ctx.moveTo(d.x + 2.1, d.y); ctx.arc(d.x, d.y, 2.1, 0, 7); }
          ctx.fill();
        }
        // The colours, carried in the centre of the line.
        if (!broken && sim.dots.length > 3) {
          const c = sim.dots[Math.floor(sim.dots.length / 2)];
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
