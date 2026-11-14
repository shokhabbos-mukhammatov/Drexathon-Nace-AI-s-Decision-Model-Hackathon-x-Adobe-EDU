import { memo, useEffect } from 'react';
import { motion } from 'motion/react';

// The explanatory page: what Clio is, how its parts fit, and what happens in one half hour.
// Figures quoted here are the ones measured on this build (see docs/plan.md and data/).

const INK = '#2b2118';
const SOFT = '#5a4a3a';

interface BoxProps { x: number; y: number; w: number; h: number; title: string; lines: string[]; tone?: 'nace' | 'own' | 'ext' | 'data' }

function Box({ x, y, w, h, title, lines, tone = 'own' }: BoxProps) {
  const fill = tone === 'nace' ? '#e7d4c4' : tone === 'ext' ? '#dfe3d6' : tone === 'data' ? '#ece2c2' : '#f5ecd0';
  const edge = tone === 'nace' ? '#9c2f25' : tone === 'ext' ? '#4e5a2a' : INK;
  return (
    <g>
      <rect x={x + 3} y={y + 4} width={w} height={h} fill={INK} opacity={0.14} />
      <rect x={x} y={y} width={w} height={h} fill={fill} stroke={edge} strokeWidth={tone === 'data' ? 1 : 1.6} strokeDasharray={tone === 'data' ? '5 3' : undefined} />
      <text x={x + 12} y={y + 22} className="how-box-title" fill={edge}>{title}</text>
      {lines.map((l, i) => (
        <text key={i} x={x + 12} y={y + 41 + i * 16} className="how-box-line" fill={SOFT}>{l}</text>
      ))}
    </g>
  );
}

function Arrow({ d, label, at, dashed }: { d: string; label?: string; at?: [number, number]; dashed?: boolean }) {
  return (
    <g>
      <path d={d} fill="none" stroke={INK} strokeWidth={1.5} markerEnd="url(#how-arrow)" strokeDasharray={dashed ? '5 4' : undefined} />
      {label && at && (
        <text x={at[0]} y={at[1]} className="how-arrow-label" textAnchor="middle">{label}</text>
      )}
    </g>
  );
}

function Architecture() {
  return (
    <svg className="how-diagram" viewBox="0 0 1000 520" role="img" aria-label="Architecture: documents are read by NDI into personas; the Clio server runs the battle and asks Drex for every decision, DeepInfra for words, and Intern for the report; the browser shows it and sends the player's orders.">
      <defs>
        <marker id="how-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill={INK} />
        </marker>
      </defs>

      {/* documents to personas */}
      <Box x={14} y={22} w={214} h={92} tone="ext" title="Primary sources" lines={['Scanned reports, letters and', 'testimony of each commander', '(public domain, archive.org)']} />
      <Box x={14} y={150} w={214} h={92} tone="nace" title="NDI Extract" lines={['Reads the scan and returns', 'traits, each with the quote', 'and page it rests on']} />
      <Box x={14} y={278} w={214} h={76} tone="data" title="Personas" lines={['data/personas/*.json', 'seven commanders, cached']} />
      <Arrow d="M121 114V148" />
      <Arrow d="M121 242V276" />

      {/* the server */}
      <rect x={282} y={22} width={356} height={332} fill="none" stroke={INK} strokeWidth={1.2} strokeDasharray="2 4" />
      <text x={296} y={44} className="how-group">Clio server · Node, TypeScript</text>
      <Box x={300} y={58} w={320} h={124} title="Battle engine" lines={['The map, legal moves, march time by ground,', 'combat arithmetic on a fixed seed, the order of', 'a half hour. Nothing here is a judgement,', 'so none of it is a model call.']} />
      <Box x={300} y={200} w={150} h={136} title="Decider" lines={['Puts each agent’s', 'question to Drex:', 'state, options,', 'nothing else']} />
      <Box x={470} y={200} w={150} h={136} title="Writers" lines={['Dispatch lines and', 'the after-action', 'report: words only,', 'after the decision']} />
      <Arrow d="M228 316H296" label="traits" at={[262, 308]} />

      {/* the models */}
      <Box x={700} y={22} w={286} h={104} tone="nace" title="Drex · decision model" lines={['POST /v1/systemone', 'A probability for every option, in about', 'a third of a second. About 170 a battle.']} />
      <Box x={700} y={146} w={286} h={88} tone="ext" title="DeepInfra · Qwen 27B" lines={['Writes the one-line dispatch once', 'Drex has decided. Never decides.']} />
      <Box x={700} y={254} w={286} h={100} tone="nace" title="Intern · agent harness" lines={['Runs headless on the decision log and', 'writes the after-action report. System 1', 'is Drex; System 2 is the DeepInfra model.']} />
      {/* the server calls out to each service; drawn from its edge so no line crosses a box */}
      <Arrow d="M640 74H698" />
      <Arrow d="M640 190H698" />
      <Arrow d="M640 304H698" />

      {/* the browser and the player */}
      <Box x={300} y={410} w={320} h={92} title="Browser · React" lines={['Period map in SVG, soldiers on a canvas,', 'commander panels, telegraph, ledger']} />
      <Arrow d="M430 354V408" label="state, by WebSocket" at={[356, 386]} />
      <Arrow d="M500 408V356" label="orders, by REST" at={[566, 386]} />
      <Box x={700} y={410} w={286} h={92} tone="ext" title="The player" lines={['Takes any commander’s place and', 'clicks or writes his order']} />
      <Arrow d="M700 456H622" />
      <Arrow d="M130 354C130 470 220 456 298 456" dashed label="every trait keeps its citation" at={[170, 488]} />
    </svg>
  );
}

const STEPS: { n: number; who: 'Code' | 'Drex' | 'Words'; title: string; text: string }[] = [
  { n: 1, who: 'Code', title: 'Couriers arrive', text: 'Orders and replies sent earlier reach the commanders they were sent to.' },
  { n: 2, who: 'Drex', title: 'The army commanders decide', text: 'Lee names the objective. Meade answers what he finds and sends each reserve where the line is threatened.' },
  { n: 3, who: 'Drex', title: 'Subordinates answer their orders', text: 'Obey, delay, protest or act on their own judgement. A protest goes up the chain; a subordinate who disobeys is reported to his superior, who rules on it. Each commander knows what his side has heard so far.' },
  { n: 4, who: 'Drex', title: 'Brigades are committed', text: 'A commander judges when each brigade goes in, and whether one that has taken its ground pushes on.' },
  { n: 5, who: 'Code', title: 'The march', text: 'How far a column gets depends on the road, the ground it enters, any stream to ford and how tired it is.' },
  { n: 6, who: 'Drex', title: 'Brigades in contact react', text: 'Each one decides for itself: press, stand, countercharge or fall back.' },
  { n: 7, who: 'Code', title: 'Combat and its consequences', text: 'Seeded arithmetic settles losses, morale, routs and who holds the ground.' },
  { n: 8, who: 'Words', title: 'Dispatches', text: 'A one-line dispatch is written for each command decision, and the new state goes to every browser.' },
];

const TOC: [string, string][] = [
  ['how-parts', 'The parts'],
  ['how-architecture', 'Architecture'],
  ['how-turn', 'One half hour'],
  ['how-decision', 'A decision'],
  ['how-persona', 'From document to commander'],
  ['how-measured', 'What was measured'],
];

function HowItWorksImpl({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay how-overlay" onClick={onClose}>
      <motion.article className="plate how" onClick={(e) => e.stopPropagation()} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.35 }} role="dialog" aria-label="How Clio works">
        <button type="button" className="how-close" onClick={onClose} aria-label="Close">×</button>
        <p className="how-kicker">Clio · the muse of history</p>
        <h1>How it works</h1>
        <p className="how-lede">
          A staff ride is the exercise of walking a battlefield to study how its commanders decided. Clio is that exercise at software speed: a real battle on a period map, every commander an agent built from his own
          documents, every decision made by a decision model, and any commander’s place open to you.
        </p>
        <nav className="how-toc" aria-label="On this page">
          {TOC.map(([id, label]) => (
            <button key={id} type="button" onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              {label}
            </button>
          ))}
        </nav>

        <section id="how-parts">
          <h2>The parts, and the one job each has</h2>
          <div className="how-parts">
            <div><h3>Drex</h3><p>Makes every agent decision. It is given a state and a fixed list of options and returns a probability for each; it cannot write an order that is not on the list.</p></div>
            <div><h3>NDI</h3><p>Reads each commander’s scanned reports and letters and extracts his character, each trait with the sentence and page it came from.</p></div>
            <div><h3>Intern</h3><p>An agent that reads the battle’s decision log at dusk and writes the after-action report: what happened, where it left the record, and what a commander should learn.</p></div>
            <div><h3>DeepInfra</h3><p>Hosts the only text-writing model. It turns a decision already made into one line in the commander’s voice. It never chooses.</p></div>
            <div><h3>Code</h3><p>Owns everything that is not a judgement: the map, legal moves, how long a march takes over that ground, and the arithmetic of a fight, on a fixed seed so a run can be repeated.</p></div>
          </div>
        </section>

        <section id="how-architecture">
          <h2>Architecture</h2>
          <Architecture />
          <p className="how-caption">Red boxes are Nace products. The server holds the one battle in memory and sends the whole state to every browser after each change, which is also what lets a second tab play another commander.</p>
        </section>

        <section id="how-turn">
          <h2>One half hour</h2>
          <p>The afternoon runs from 2:30 PM to dusk in eleven half hours. Each one goes through the same sequence, and about twenty-eight agents decide in it.</p>
          <ol className="how-steps">
            {STEPS.map((s) => (
              <li key={s.n} className={`who-${s.who.toLowerCase()}`}>
                <span className="how-step-n">{s.n}</span>
                <div>
                  <h3>{s.title} <em>{s.who === 'Words' ? 'DeepInfra' : s.who}</em></h3>
                  <p>{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p>When you hold a commander, his decisions in steps 2 and 3 wait for you. Drex still answers first, and the choice it expects is marked “likely in 1863”. You may click an option or write the order in your own words; Drex then reads your sentence and maps it to one of the legal options.</p>
        </section>

        <section id="how-decision">
          <h2>A decision</h2>
          <div className="how-decision">
            <div>
              <h3>What Drex is given</h3>
              <pre>{`state
  you         Maj. Gen. Daniel E. Sickles, III Corps
  character   "It was not through any
              misinterpretation of orders." ...
  order       Prolong the line of the II Corps
              along Cemetery Ridge
  situation   the Peach Orchard, higher ground,
              three quarters of a mile ahead

question    How does he respond to the order?
options     obeys · delays · protests ·
            acts on his own judgement`}</pre>
            </div>
            <div>
              <h3>What comes back</h3>
              <ul className="how-bars">
                <li><span>Obeys the order</span><i><b style={{ width: '1%' }} /></i><em>1%</em></li>
                <li><span>Delays</span><i><b style={{ width: '1%' }} /></i><em>1%</em></li>
                <li><span>Protests</span><i><b style={{ width: '1%' }} /></i><em>1%</em></li>
                <li className="is-chosen"><span>Acts on his own judgement</span><i><b style={{ width: '97%' }} /></i><em>97%</em></li>
              </ul>
              <p className="how-caption">Recorded on this build. He advanced to the Peach Orchard in 1863, too. Click “why?” on any decision and Clio asks again with each trait removed, to show which one moved it.</p>
            </div>
          </div>
        </section>

        <section id="how-persona">
          <h2>From document to commander</h2>
          <ol className="how-flow">
            <li><strong>A scan.</strong> For example Longstreet’s report in the Official Records, a 93 MB volume on archive.org, three pages of it.</li>
            <li><strong>NDI Extract</strong> with a small schema: a label, one sentence, and a quote copied word for word.</li>
            <li><strong>A trait with its source.</strong> “Cautious under pressure”, resting on his words “Fearing that my force was too weak to venture to make an attack, I delayed”. Pages 358 to 359.</li>
            <li><strong>Into the state</strong> Drex reads for every decision that commander makes, and onto his panel, where the citation can be opened.</li>
          </ol>
          <p>Three of the seven left no report for that day; what they wrote later is self-justifying, and their panels rest on those later accounts.</p>
        </section>

        <section id="how-measured">
          <h2>What was measured</h2>
          <table className="how-table">
            <tbody>
              <tr><th scope="row">One full battle on Drex</th><td>about 170 decisions, about 18 seconds, $0.0019</td></tr>
              <tr><th scope="row">Thirty decisions on Drex</th><td>355 ms each (median), $0.00041 in all</td></tr>
              <tr><th scope="row">The same thirty on a 27B model, reasoning off</th><td>594 ms each, $0.0029; it agreed with Drex on 29</td></tr>
              <tr><th scope="row">The same thirty, reasoning on</th><td>9,544 ms each, $0.0315</td></tr>
              <tr><th scope="row">Documented decisions reproduced on autopilot</th><td>8 of 9 with the personas, 7 of 8 without</td></tr>
            </tbody>
          </table>
          <p className="how-caption">The count of decisions reproduced barely moves without the personas, because the model already knows these commanders by name. What the personas change is conduct: with his, Hood protests and is refused, as he was; without it he ignores the order. The map is a schematic of the ground, not a survey.</p>
        </section>
      </motion.article>
    </div>
  );
}

export const HowItWorks = memo(HowItWorksImpl);
