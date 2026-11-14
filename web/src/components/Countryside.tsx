import { memo, useMemo } from 'react';
import type { MapNode } from '../../../shared/types';
import { MAP_H, MAP_W, type Pt, rng, smoothPath } from '../geo';

// The country the battle was fought over, drawn the way an 1860s survey would show it:
// relief in contours and hachures, streams, woods, the patchwork of fenced fields, farmsteads
// with their orchards and lanes, the minor roads, and the edge of the town.
//
// This layer is specific to Gettysburg and is placed to agree with the battle's own locations
// (server/data/gettysburg.ts). It is a schematic of the ground, not a survey: places are in
// their right relation to one another, not to scale. Another battle supplies its own sheet.

const INK = '#2b2118';
const SOFT = '#5a4a3a';
const WATER = '#55788a';

type Loop = { c: Pt; rx: number; ry: number; rot?: number };

const RIDGES: { name?: string; spine: Pt[]; w: number; label?: { at: Pt; rot: number } }[] = [
  { spine: [[120, 50], [150, 150], [215, 250], [300, 330], [315, 450], [360, 560], [380, 690], [430, 800], [475, 940]], w: 36 },
  { spine: [[998, 150], [1010, 300], [1040, 410], [1050, 520], [1062, 615]], w: 30 },
  { name: "Houck's Ridge", spine: [[826, 690], [846, 755], [852, 825]], w: 20, label: { at: [806, 760], rot: 76 } },
];

const HILLS: { name?: string; loop: Loop; levels: number; label?: Pt }[] = [
  { name: 'Cemetery Hill', loop: { c: [1030, 96], rx: 62, ry: 44, rot: 0.3 }, levels: 3, label: [1046, 58] },
  { name: "Culp's Hill", loop: { c: [1275, 128], rx: 72, ry: 88, rot: -0.2 }, levels: 4, label: [1275, 56] },
  { name: 'Powers Hill', loop: { c: [1335, 322], rx: 44, ry: 36, rot: 0.5 }, levels: 3, label: [1335, 280] },
  { loop: { c: [1075, 775], rx: 58, ry: 80, rot: 0.1 }, levels: 4 },
  { loop: { c: [1030, 925], rx: 84, ry: 66, rot: -0.3 }, levels: 5 },
  { loop: { c: [596, 566], rx: 62, ry: 40, rot: 0.4 }, levels: 2 },
  { loop: { c: [704, 652], rx: 36, ry: 28, rot: 0 }, levels: 2 },
  { name: "Benner's Hill", loop: { c: [1500, 118], rx: 46, ry: 60, rot: 0.2 }, levels: 3, label: [1500, 50] },
];

const WOODS: { name?: string; loop: Loop; label?: Pt }[] = [
  { name: "McMillan's Woods", loop: { c: [205, 215], rx: 52, ry: 62, rot: 0.5 }, label: [250, 160] },
  { loop: { c: [300, 335], rx: 74, ry: 58, rot: 0.2 } },
  { loop: { c: [348, 560], rx: 62, ry: 84, rot: 0.1 } },
  { name: "Biesecker's Woods", loop: { c: [425, 838], rx: 84, ry: 62, rot: -0.2 }, label: [330, 905] },
  { loop: { c: [700, 705], rx: 84, ry: 56, rot: 0.3 } },
  { name: "Trostle's Woods", loop: { c: [868, 562], rx: 46, ry: 32, rot: 0.2 }, label: [868, 520] },
  { name: "Weikert's Woods", loop: { c: [996, 646], rx: 36, ry: 44, rot: 0 }, label: [1010, 596] },
  { loop: { c: [1030, 930], rx: 88, ry: 62, rot: -0.3 } },
  { loop: { c: [1128, 800], rx: 30, ry: 72, rot: 0.1 } },
  { loop: { c: [1282, 132], rx: 86, ry: 96, rot: -0.2 } },
  { name: "Ziegler's Grove", loop: { c: [985, 178], rx: 24, ry: 22, rot: 0 }, label: [940, 150] },
  { loop: { c: [1262, 524], rx: 62, ry: 44, rot: 0.4 } },
  { loop: { c: [1452, 330], rx: 50, ry: 64, rot: -0.3 } },
  { loop: { c: [62, 440], rx: 34, ry: 96, rot: 0.1 } },
  { loop: { c: [1500, 760], rx: 70, ry: 80, rot: 0.3 } },
  { loop: { c: [230, 760], rx: 60, ry: 50, rot: -0.4 } },
];

const STREAMS: { name: string; pts: Pt[]; w: number; labelAt: number }[] = [
  { name: 'Plum Run', pts: [[905, 330], [915, 430], [925, 520], [945, 610], [960, 700], [930, 790], [905, 850], [880, 920], [862, 990]], w: 1.7, labelAt: 22 },
  { name: 'Rose Run', pts: [[598, 640], [650, 700], [720, 772], [790, 850], [858, 930]], w: 1.2, labelAt: 58 },
  { name: 'Willoughby Run', pts: [[42, 40], [72, 200], [56, 350], [92, 500], [72, 650], [112, 800], [92, 990]], w: 1.8, labelAt: 62 },
  { name: 'Rock Creek', pts: [[1420, 24], [1452, 140], [1502, 260], [1492, 380], [1542, 500], [1522, 640], [1572, 780], [1552, 990]], w: 2.3, labelAt: 46 },
];

const BYROADS: { name?: string; pts: Pt[] }[] = [
  { pts: [[640, 370], [760, 190], [886, 28]] }, // Emmitsburg Road into the town
  { pts: [[430, 800], [360, 900], [302, 986]] }, // and away to the south-west
  { name: 'Taneytown Road', pts: [[930, 30], [1040, 100], [1150, 170], [1164, 400], [1152, 600], [1178, 800], [1192, 986]] },
  { name: 'Baltimore Pike', pts: [[962, 30], [1110, 110], [1255, 235], [1400, 430], [1586, 650]] },
  { name: 'Fairfield Road', pts: [[862, 26], [520, 84], [150, 150], [28, 192]] },
  { pts: [[960, 700], [1040, 668], [1158, 640]] }, // Wheatfield Road on to the Taneytown Road
  { pts: [[360, 560], [200, 578], [28, 596]] }, // Millerstown Road westward
  { name: 'Hanover Road', pts: [[1000, 32], [1300, 30], [1586, 70]] },
];

const FARMS: { name: string; at: Pt; orchard?: boolean; rot?: number }[] = [
  { name: 'Sherfy', at: [548, 536], orchard: true, rot: 28 },
  { name: 'Wentz', at: [636, 596], rot: 28 },
  { name: 'Klingle', at: [614, 468], rot: 28 },
  { name: 'Rogers', at: [676, 424], rot: 28 },
  { name: 'Codori', at: [742, 262], orchard: true, rot: 34 },
  { name: 'Trostle', at: [812, 452], rot: 8 },
  { name: 'G. Weikert', at: [938, 566], rot: -6 },
  { name: 'J. Weikert', at: [1012, 706], rot: 10 },
  { name: 'Rose', at: [640, 748], orchard: true, rot: 20 },
  { name: 'Snyder', at: [508, 722], rot: 30 },
  { name: 'Slyder', at: [806, 912], orchard: true, rot: -10 },
  { name: 'Bushman', at: [690, 884], rot: 14 },
  { name: 'Warfield', at: [470, 648], rot: 32 },
  { name: 'H. Spangler', at: [398, 404], rot: 0 },
  { name: 'Pitzer', at: [250, 520], rot: -8 },
  { name: 'Bliss', at: [606, 232], orchard: true, rot: 0 },
  { name: 'Hummelbaugh', at: [1104, 388], rot: 6 },
  { name: 'Patterson', at: [1196, 478], rot: 0 },
  { name: 'G. Spangler', at: [1290, 420], orchard: true, rot: -12 },
  { name: 'Culp', at: [1150, 62], rot: 20 },
  { name: 'McAllister', at: [1470, 470], rot: 12 },
  { name: 'Currens', at: [240, 866], rot: 20 },
];

const NOTES: { text: string; at: Pt; rot?: number; size?: number }[] = [
  { text: 'Valley of Death', at: [978, 742], rot: -66, size: 10 },
  { text: 'Slaughter Pen', at: [922, 884], rot: 0, size: 9.5 },
  { text: 'Lutheran Seminary', at: [214, 104], rot: 0, size: 10 },
  { text: 'Evergreen Cemetery', at: [1100, 136], rot: 0, size: 9.5 },
  { text: 'Stone wall', at: [820, 706], rot: 8, size: 8.5 },
];

function loopPoints(l: Loop, scale: number, r: () => number, rough = 0.1, n = 18): Pt[] {
  const rot = l.rot ?? 0; const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2; const k = scale * (1 + (r() - 0.5) * 2 * rough);
    const x = Math.cos(a) * l.rx * k; const y = Math.sin(a) * l.ry * k;
    out.push([l.c[0] + x * Math.cos(rot) - y * Math.sin(rot), l.c[1] + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return out;
}

function closed(pts: Pt[]): string {
  const n = pts.length; if (n < 3) return '';
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]);
  let d = `M${m0[0].toFixed(1)} ${m0[1].toFixed(1)}`;
  for (let i = 0; i < n; i++) { const m = mid(pts[i], pts[(i + 1) % n]); d += `Q${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`; }
  return d + 'Z';
}

/** Points along a polyline every `step`, with the unit normal at each. */
function along(pts: Pt[], step: number): { p: Pt; n: Pt }[] {
  const out: { p: Pt; n: Pt }[] = [];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1]; const [bx, by] = pts[i];
    const len = Math.hypot(bx - ax, by - ay) || 1; const nx = -(by - ay) / len; const ny = (bx - ax) / len;
    for (let s = 0; s < len; s += step) out.push({ p: [ax + ((bx - ax) * s) / len, ay + ((by - ay) * s) / len], n: [nx, ny] });
  }
  return out;
}

function band(spine: Pt[], w: number, r: () => number): Pt[] {
  const s = along(spine, 26);
  const left = s.map(({ p, n }) => [p[0] + n[0] * w * (0.85 + r() * 0.3), p[1] + n[1] * w * (0.85 + r() * 0.3)] as Pt);
  const right = s.map(({ p, n }) => [p[0] - n[0] * w * (0.85 + r() * 0.3), p[1] - n[1] * w * (0.85 + r() * 0.3)] as Pt).reverse();
  return [...left, ...right];
}

function inside(p: Pt, poly: Pt[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]; const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function tree(x: number, y: number, s: number): string {
  // a small scalloped crown with a shadow stroke on the south-east
  return `M${(x - s).toFixed(1)} ${y.toFixed(1)}a${(s * 0.55).toFixed(1)} ${(s * 0.55).toFixed(1)} 0 0 1 ${(s * 0.9).toFixed(1)} ${(-s * 0.7).toFixed(1)}a${(s * 0.6).toFixed(1)} ${(s * 0.6).toFixed(1)} 0 0 1 ${(s * 1.05).toFixed(1)} ${(s * 0.6).toFixed(1)}a${(s * 0.55).toFixed(1)} ${(s * 0.55).toFixed(1)} 0 0 1 ${(-s * 0.85).toFixed(1)} ${(s * 0.8).toFixed(1)}a${(s * 0.6).toFixed(1)} ${(s * 0.6).toFixed(1)} 0 0 1 ${(-s * 1.1).toFixed(1)} ${(-s * 0.7).toFixed(1)}z`;
}

function CountrysideImpl({ nodes, avoid }: { nodes: MapNode[]; avoid: Pt[] }) {
  const isGettysburg = useMemo(() => nodes.some((n) => n.id === 'little_round_top') && nodes.some((n) => n.id === 'peach_orchard'), [nodes]);

  const art = useMemo(() => {
    if (!isGettysburg) return null;
    const r = rng(18630702);

    const woods = WOODS.map((w) => ({ ...w, poly: loopPoints(w.loop, 1, r, 0.16, 16) }));
    const hills = HILLS.map((h) => ({ ...h, rings: Array.from({ length: h.levels }, (_, k) => loopPoints(h.loop, 1 - k / (h.levels + 0.6), r, 0.07, 20)) }));
    const ridges = RIDGES.map((g) => ({ ...g, outer: band(g.spine, g.w, r), inner: band(g.spine, g.w * 0.5, r) }));

    // Hachures: short strokes running down the slope on both flanks of each ridge.
    let hach = '';
    for (const g of ridges) for (const { p, n } of along(g.spine, 7)) for (const side of [1, -1]) {
      const a = g.w * (0.55 + r() * 0.15); const b = g.w * (0.95 + r() * 0.3); const j = (r() - 0.5) * 4;
      hach += `M${(p[0] + n[0] * a * side + j).toFixed(1)} ${(p[1] + n[1] * a * side).toFixed(1)}L${(p[0] + n[0] * b * side + j).toFixed(1)} ${(p[1] + n[1] * b * side).toFixed(1)}`;
    }
    for (const h of hills) {
      const ring = h.rings[0]; const c = h.loop.c;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i]; const b = ring[(i + 1) % ring.length];
        for (let t = 0; t < 1; t += 0.2) {
          const x = a[0] + (b[0] - a[0]) * t; const y = a[1] + (b[1] - a[1]) * t;
          const dx = x - c[0]; const dy = y - c[1]; const l = Math.hypot(dx, dy) || 1; const e = 5 + r() * 6;
          hach += `M${x.toFixed(1)} ${y.toFixed(1)}l${((dx / l) * e).toFixed(1)} ${((dy / l) * e).toFixed(1)}`;
        }
      }
    }

    // Trees: stippled through every wood, thicker toward the middle.
    let trees = '';
    for (const w of woods) {
      const area = Math.PI * w.loop.rx * w.loop.ry;
      for (let i = 0; i < area / 150; i++) {
        const p: Pt = [w.loop.c[0] + (r() - 0.5) * 2.3 * Math.max(w.loop.rx, w.loop.ry), w.loop.c[1] + (r() - 0.5) * 2.3 * Math.max(w.loop.rx, w.loop.ry)];
        if (inside(p, w.poly)) trees += tree(p[0], p[1], 3 + r() * 2.2);
      }
    }

    // Fields: an irregular lattice of fenced enclosures over the open country.
    const stepX = 92; const stepY = 78;
    const cols = Math.ceil(MAP_W / stepX) + 1; const rows = Math.ceil(MAP_H / stepY) + 1;
    const grid: Pt[][] = [];
    for (let j = 0; j < rows; j++) { grid.push([]); for (let i = 0; i < cols; i++) grid[j].push([i * stepX + (r() - 0.5) * 34 + (j % 2) * 14, j * stepY + (r() - 0.5) * 28]); }
    const blocked = (p: Pt) =>
      p[0] < 34 || p[1] < 34 || p[0] > MAP_W - 34 || p[1] > MAP_H - 34 ||
      woods.some((w) => inside(p, w.poly)) || hills.some((h) => h.levels > 2 && inside(p, h.rings[0])) ||
      (p[1] < 92 && p[0] > 812 && p[0] < 1012) || avoid.some((a) => Math.abs(p[0] - a[0]) < 215 && Math.abs(p[1] - a[1]) < 125);
    const fields: { d: string; kind: number }[] = [];
    let fences = '';
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
      const q = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]];
      const c: Pt = [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2];
      if (blocked(c)) continue;
      const d = `M${q.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L')}Z`;
      fields.push({ d, kind: Math.floor(r() * 6) });
      fences += d;
    }

    // Stone walls and worm fences along the lines the armies used.
    const walls: Pt[][] = [
      [[1012, 196], [1018, 300], [1044, 404], [1054, 520]],
      [[772, 690], [818, 698], [866, 684]],
      [[1046, 706], [1056, 770], [1048, 836]],
      [[640, 380], [700, 300], [750, 220]],
    ];

    // The town: a few blocks of the south end, cut by the top margin.
    const blocks: string[] = [];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 7; i++) {
      const x = 822 + i * 26 + (j % 2) * 4; const y = 30 + j * 19;
      if (r() < 0.12) continue;
      blocks.push(`M${x} ${y}h${17 + r() * 4}v${11 + r() * 3}h${-(17 + r() * 4)}z`);
    }

    return { woods, hills, ridges, hach, trees, fields, fences, walls, blocks };
  }, [isGettysburg, avoid]);

  if (!art) return null;

  return (
    <g className="countryside">
      <defs>
        {[18, -32, 74].map((a, i) => (
          <pattern key={a} id={`cs-furrow-${i}`} width="5.5" height="5.5" patternUnits="userSpaceOnUse" patternTransform={`rotate(${a})`}>
            <path d="M0 2.7h5.5" stroke={INK} strokeWidth="0.45" opacity="0.5" />
          </pattern>
        ))}
        <pattern id="cs-grain" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(24)">
          <path d="M1.5 1.5v2M5 4.5v2" stroke={INK} strokeWidth="0.55" opacity="0.5" strokeLinecap="round" />
        </pattern>
        <pattern id="cs-meadow" width="11" height="9" patternUnits="userSpaceOnUse">
          <path d="M2 6l1-2.4M3.4 6l.4-2.8M4.8 6l-.3-2.2M8 2.4l.8-1.6M9 2.4l.1-1.8" stroke={INK} strokeWidth="0.4" opacity="0.42" strokeLinecap="round" />
        </pattern>
        <filter id="cs-soft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id="cs-hand" x="-3%" y="-3%" width="106%" height="106%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="11" result="t" />
          <feDisplacementMap in="SourceGraphic" in2="t" scale="1.8" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>

      {/* fields under everything */}
      <g>
        {art.fields.map((f, i) =>
          f.kind >= 5 ? null : <path key={i} d={f.d} fill={f.kind < 3 ? `url(#cs-furrow-${f.kind})` : f.kind === 3 ? 'url(#cs-grain)' : 'url(#cs-meadow)'} opacity={0.5} />,
        )}
        <path d={art.fences} fill="none" stroke={SOFT} strokeWidth={0.55} opacity={0.5} strokeDasharray="5 1.2" filter="url(#cs-hand)" />
      </g>

      {/* relief: a wash of shade, then contours, then hachures */}
      <g filter="url(#cs-soft)" opacity={0.5}>
        {art.ridges.map((g, i) => <path key={i} d={closed(g.outer)} fill="#7b5a2a" opacity={0.3} />)}
        {art.hills.map((h, i) => <path key={i} d={closed(h.rings[0])} fill="#7b5a2a" opacity={0.34} />)}
      </g>
      <g fill="none" stroke={SOFT} strokeWidth={0.7} opacity={0.6} filter="url(#cs-hand)">
        {art.ridges.map((g, i) => (
          <g key={i}>
            <path d={closed(g.outer)} />
            <path d={closed(g.inner)} strokeDasharray="6 2" />
          </g>
        ))}
        {art.hills.map((h, i) => h.rings.map((ring, k) => <path key={`${i}-${k}`} d={closed(ring)} strokeWidth={k === 0 ? 0.85 : 0.6} />))}
      </g>
      <path d={art.hach} fill="none" stroke={INK} strokeWidth={0.55} opacity={0.42} strokeLinecap="round" />

      {/* water */}
      <g fill="none" strokeLinecap="round" filter="url(#cs-hand)">
        {STREAMS.map((s, i) => (
          <g key={s.name}>
            <path d={smoothPath(s.pts)} stroke={WATER} strokeWidth={s.w + 1.6} opacity={0.28} />
            <path id={`cs-stream-${i}`} d={smoothPath(s.pts)} stroke={WATER} strokeWidth={s.w} opacity={0.85} />
          </g>
        ))}
      </g>
      {STREAMS.map((s, i) => (
        <text key={s.name} className="map-italic" fontSize={11} fill={WATER} dy={-4} letterSpacing="1.2">
          <textPath href={`#cs-stream-${i}`} startOffset={`${s.labelAt}%`}>{s.name}</textPath>
        </text>
      ))}

      {/* woods */}
      <g filter="url(#cs-hand)">
        {art.woods.map((w, i) => <path key={i} d={closed(w.poly)} fill="#6d7a3e" opacity={0.17} />)}
        {art.woods.map((w, i) => <path key={'e' + i} d={closed(w.poly)} fill="none" stroke={SOFT} strokeWidth={0.6} opacity={0.45} strokeDasharray="1.5 3" />)}
        <path d={art.trees} fill="#dccf9c" fillOpacity={0.75} stroke={INK} strokeWidth={0.55} opacity={0.72} />
      </g>

      {/* minor roads */}
      <g fill="none" strokeLinecap="round" filter="url(#cs-hand)">
        {BYROADS.map((b, i) => (
          <g key={i}>
            <path d={smoothPath(b.pts)} stroke={INK} strokeWidth={3.6} opacity={0.62} />
            <path id={`cs-road-${i}`} d={smoothPath(b.pts)} stroke="#e9d9ae" strokeWidth={2} />
          </g>
        ))}
      </g>
      {BYROADS.map((b, i) => b.name && (
        <text key={b.name} className="map-italic" fontSize={12} fill={SOFT} dy={-5} letterSpacing="1.4">
          <textPath href={`#cs-road-${i}`} startOffset="56%" textAnchor="middle">{b.name}</textPath>
        </text>
      ))}

      {/* walls */}
      <g fill="none" stroke={INK} strokeWidth={1.5} strokeDasharray="0.6 2.6" strokeLinecap="round" opacity={0.7}>
        {art.walls.map((w, i) => <path key={i} d={smoothPath(w)} />)}
      </g>

      {/* the town */}
      <g>
        <path d={art.blocks.join('')} fill={INK} opacity={0.5} />
        <text x={912} y={104} textAnchor="middle" className="map-engraved" fontSize={15} fill={INK} letterSpacing="5" opacity={0.8}>GETTYSBURG</text>
      </g>

      {/* farmsteads */}
      {FARMS.map((f) => (
        <g key={f.name} transform={`translate(${f.at[0]} ${f.at[1]})`}>
          <g transform={`rotate(${f.rot ?? 0})`}>
            <rect x={-13} y={-10} width={26} height={20} fill="none" stroke={SOFT} strokeWidth={0.5} strokeDasharray="2 1.5" opacity={0.7} />
            <rect x={-8} y={-5} width={6.5} height={5} fill={INK} opacity={0.82} />
            <rect x={1} y={-1} width={9} height={6} fill={INK} opacity={0.82} />
            <rect x={-7} y={3.5} width={3.2} height={2.6} fill={INK} opacity={0.7} />
            {f.orchard && (
              <g fill="#7c8a45" stroke={INK} strokeWidth={0.35} opacity={0.75}>
                {Array.from({ length: 20 }, (_, i) => <circle key={i} cx={17 + (i % 5) * 5.4} cy={-9 + Math.floor(i / 5) * 5.4} r={1.7} />)}
              </g>
            )}
          </g>
          <text x={0} y={-15} textAnchor="middle" className="map-italic cs-farm" fontSize={9.8} fill={SOFT}>{f.name}</text>
        </g>
      ))}

      {/* names of the ground */}
      {art.hills.map((h) => h.name && h.label && (
        <text key={h.name} x={h.label[0]} y={h.label[1]} textAnchor="middle" className="map-italic" fontSize={14} fill={INK} letterSpacing="0.6" opacity={0.85}>{h.name}</text>
      ))}
      {art.ridges.map((g) => g.name && g.label && (
        <text key={g.name} transform={`translate(${g.label.at[0]} ${g.label.at[1]}) rotate(${g.label.rot})`} textAnchor="middle" className="map-italic" fontSize={11} fill={SOFT} letterSpacing="1">{g.name}</text>
      ))}
      {art.woods.map((w) => w.name && w.label && (
        <text key={w.name} x={w.label[0]} y={w.label[1]} textAnchor="middle" className="map-italic" fontSize={11} fill="#4e5a2a" letterSpacing="0.5">{w.name}</text>
      ))}
      {NOTES.map((n) => (
        <text key={n.text} transform={`translate(${n.at[0]} ${n.at[1]}) rotate(${n.rot ?? 0})`} textAnchor="middle" className="map-italic" fontSize={n.size ?? 10} fill={SOFT} letterSpacing="0.6">{n.text}</text>
      ))}
    </g>
  );
}

export const Countryside = memo(CountrysideImpl);
