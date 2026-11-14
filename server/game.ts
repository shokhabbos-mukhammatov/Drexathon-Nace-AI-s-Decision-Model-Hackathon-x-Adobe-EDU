// The battle engine. Code owns the map, movement, combat arithmetic and the turn sequence;
// every judgement an agent makes (objective, compliance, orders, reaction, ruling, vote) is
// one typed question put to the decider.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  BattleEvent, Checkpoint, Commander, Compliance, Courier, Decision, DecisionKind, DecisionOption, ExplainResult,
  GameState, Holder, PendingChoice, Side, Tier, Trait, TypedResult, Unit, UnitOrder,
} from '../shared/types.ts';
import {
  BASES, BATTLE, CHECKPOINTS, COMMANDERS, COUNCIL, EDGES, INITIAL_CONTROL, NODES, OBJECTIVES, RESERVE_TARGETS, UNITS,
  type CommanderSeed, type UnitSeed,
} from './data/gettysburg.ts';
import type { AskRequest, Decider, QOption, Question } from './decider.ts';
import { writeDispatch } from './llm.ts';

const ROOT = process.cwd();
const FRONTIER_USD_PER_DECISION = 0.00333; // Nace's published figure for a frontier LLM, per decision
const FRONTIER_SECONDS_PER_DECISION = 2.0;
/** How far past the historical day the battle may be fought on: twelve half hours, to about 2 AM. */
const EXTRA_TURNS = 12;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const other = (s: Side): Side => (s === 'union' ? 'confederate' : 'union');
const words = (n: number, table: [number, string][]) => table.find(([limit]) => n <= limit)?.[1] ?? table[table.length - 1][1];
const moraleWord = (m: number) => words(m, [[20, 'broken'], [40, 'shaken'], [60, 'steady'], [80, 'in good spirits'], [100, 'eager']]);
const ammoWord = (a: number) => words(a, [[5, 'out of ammunition'], [20, 'nearly out of ammunition'], [45, 'low on ammunition'], [100, 'well supplied']]);
const fatigueWord = (f: number) => words(f, [[20, 'fresh'], [45, 'tired'], [70, 'weary'], [100, 'exhausted']]);

interface UnitMeta {
  seed: UnitSeed;
  destination?: string;
  route: number; // index into the sector list
  stance: 'press' | 'hold' | 'stand' | 'refuse' | 'charge' | 'fall_back';
  movedInto?: string; // node entered this turn
  routedUntil?: number;
  engagedTurns: number;
  /** The place it is marching to next, and how far along that road it has got (0 to 1). */
  hop?: string;
  progress: number;
  carry: number;
}
interface CmdMeta {
  seed: CommanderSeed;
  objective?: string; // key of OBJECTIVES the commander is working to
  orderObjective?: string; // objective named in the standing order
  complied: boolean;
  delays: number;
  protests: number;
  flags: Record<string, boolean | number>;
}
interface AskLog { state: any; question: Question; traits: Trait[] }

export class Game {
  state!: GameState;
  private rng = mulberry32(1863);
  private adj = new Map<string, string[]>();
  private control: Record<string, Holder> = {};
  private umeta = new Map<string, UnitMeta>();
  private cmeta = new Map<string, CmdMeta>();
  private askLog = new Map<string, AskLog>();
  private resolvers = new Map<string, (optionId: string) => void>();
  private suggestions = new Map<string, string>();
  private latencies: number[] = [];
  private allDecisions: Decision[] = [];
  private running = false;
  private autoTimer: NodeJS.Timeout | null = null;
  private autoDelay = 2600;
  private seq = 0;
  /** Half hours in a row with no fighting and no one on the move (fighting on past dusk only). */
  private quiet = 0;
  /** What each side's commanders have heard: their own side's orders and refusals, ground won and lost. */
  private news: { side: Side; turn: number; clock: string; text: string }[] = [];
  /** A subordinate who set his order aside, waiting for his superior to hear of it and rule. */
  private deviations: { subId: string; superiorId: string; original: keyof typeof OBJECTIVES; chosen: keyof typeof OBJECTIVES; turn: number }[] = [];

  constructor(private decider: Decider, private onChange: () => void) {
    for (const e of EDGES) {
      if (!this.adj.has(e.a)) this.adj.set(e.a, []);
      if (!this.adj.has(e.b)) this.adj.set(e.b, []);
      this.adj.get(e.a)!.push(e.b);
      this.adj.get(e.b)!.push(e.a);
    }
    this.reset(1863, true);
  }

  // ------------------------------------------------------------ setup

  reset(seed = 1863, personas = true) {
    this.stopAuto();
    for (const [id, resolve] of this.resolvers) resolve(this.suggestions.get(id) ?? '');
    this.resolvers.clear(); this.suggestions.clear(); this.askLog.clear();
    this.rng = mulberry32(seed);
    this.latencies = []; this.allDecisions = []; this.running = false; this.seq = 0; this.quiet = 0; this.news = []; this.deviations = [];
    this.control = {};
    for (const n of NODES) this.control[n.id] = INITIAL_CONTROL[n.id] ?? 'empty';
    this.umeta.clear(); this.cmeta.clear();

    const commanders: Commander[] = COMMANDERS.map((c) => {
      const ndi = personas ? this.loadPersona(c.id) : null;
      this.cmeta.set(c.id, { seed: c, complied: false, delays: 0, protests: 0, flags: {} });
      return {
        id: c.id, name: c.name, rank: c.rank, role: c.role, side: c.side, tier: c.tier, superiorId: c.superiorId,
        nodeId: c.nodeId, portrait: this.portraitFor(c.id),
        traits: personas ? (ndi ?? c.traits) : [],
        personaSource: personas ? (ndi ? 'ndi' : 'authored') : 'none',
        controlledBy: null, status: 'active',
      };
    });
    const units: Unit[] = UNITS.map((u) => {
      this.umeta.set(u.id, { seed: u, route: 0, stance: 'hold', engagedTurns: 0, progress: 0, carry: 0 });
      const marched = u.commanderId === 'hood' || u.commanderId === 'longstreet';
      return {
        id: u.id, name: u.name, short: u.short, side: u.side, leader: u.leader, commanderId: u.commanderId, agentId: u.agentId,
        nodeId: u.nodeId, prevNodeId: u.nodeId, strength: u.strength, strength0: u.strength,
        morale: u.id === 'robertson' || u.id === 'law' ? 85 : 80,
        fatigue: u.id === 'law' ? 38 : marched ? 26 : 10,
        ammo: u.ammo ?? 100, status: u.inReserve ? 'reserve' : 'ready', inReserve: !!u.inReserve,
      };
    });

    this.state = {
      runId: `${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}-${seed}`,
      battle: BATTLE.name, date: BATTLE.date, mode: this.decider.mode, model: this.decider.model, seed, personas,
      turn: 0, maxTurns: BATTLE.maxTurns, clock: this.clockAt(0), phase: 'ready', auto: false,
      nodes: NODES, edges: EDGES, units, commanders, couriers: [], decisions: [], events: [], pending: [],
      ledger: { decisions: 0, medianMs: 0, inputTokens: 0, costUsd: 0, frontierCostUsd: 0, frontierSeconds: 0 },
      objectives: [], fidelity: { checkpoints: CHECKPOINTS.map((c) => ({ ...c })), matched: 0, decided: 0 },
      casualties: { union: 0, confederate: 0 }, report: { status: 'idle' }, clients: this.state?.clients ?? 0,
    };
    this.loadFidelityRuns();
    // Meade's order to Sickles was given that morning.
    const sickles = this.cmd('sickles');
    sickles.standingOrder = { fromId: 'meade', fromName: 'Meade', text: OBJECTIVES.hold_ridge.text, issuedTurn: -1, receivedTurn: -1 };
    this.cmeta.get('sickles')!.orderObjective = 'hold_ridge';
    this.refreshObjectives();
    this.event('note', `${BATTLE.date}, ${this.clockLabel(0)}. The III Corps holds the low southern end of Cemetery Ridge. Longstreet's divisions are filing into the woods opposite.`);
    this.emit();
  }

  /** The portrait Intern chose for this commander (web/public/portraits), whichever format it came in. */
  private portraitFor(id: string): string {
    for (const ext of ['jpg', 'png', 'webp']) {
      if (fs.existsSync(path.join(ROOT, 'web', 'public', 'portraits', `${id}.${ext}`))) return `/portraits/${id}.${ext}`;
    }
    return '';
  }

  private loadPersona(id: string): Trait[] | null {
    try {
      const file = path.join(ROOT, 'data', 'personas', `${id}.json`);
      const json = JSON.parse(fs.readFileSync(file, 'utf8'));
      return Array.isArray(json.traits) && json.traits.length ? json.traits : null;
    } catch { return null; }
  }
  private loadFidelityRuns() {
    try {
      const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fidelity.json'), 'utf8'));
      this.state.fidelity.withPersona = json.withPersona;
      this.state.fidelity.withoutPersona = json.withoutPersona;
    } catch { /* not run yet */ }
    try {
      const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'measured.json'), 'utf8'));
      this.state.ledger.measured = m;
    } catch { /* not run yet */ }
  }

  // ------------------------------------------------------------ helpers

  private emit() { this.onChange(); }
  private clockAt(turn: number) {
    const m = BATTLE.startMinutes + turn * BATTLE.turnMinutes;
    return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }
  private clockLabel(turn: number) {
    const m = BATTLE.startMinutes + turn * BATTLE.turnMinutes;
    const h = Math.floor(m / 60) % 24; const mm = String(m % 60).padStart(2, '0');
    return `${h % 12 === 0 ? 12 : h % 12}:${mm} ${h >= 12 ? 'PM' : 'AM'}`;
  }
  private cmd(id: string) { return this.state.commanders.find((c) => c.id === id)!; }
  private unit(id: string) { return this.state.units.find((u) => u.id === id)!; }
  private node(id: string) { return NODES.find((n) => n.id === id)!; }
  private nodeName(id: string) { return this.node(id)?.name ?? id; }
  private alive(u: Unit) { return u.strength > 0 && !u.inReserve; }
  private fighting(u: Unit) { return this.alive(u) && u.status !== 'routed'; }
  private at(nodeId: string, side?: Side) { return this.state.units.filter((u) => u.nodeId === nodeId && this.fighting(u) && (!side || u.side === side)); }
  private contested(nodeId: string) { return this.at(nodeId, 'union').length > 0 && this.at(nodeId, 'confederate').length > 0; }
  private tell(side: Side | 'both', text: string) {
    const t = this.state.turn; const clock = this.clockLabel(t);
    for (const sd of side === 'both' ? (['union', 'confederate'] as Side[]) : [side]) this.news.push({ side: sd, turn: t, clock, text });
    if (this.news.length > 120) this.news.splice(0, this.news.length - 120);
  }

  private event(kind: BattleEvent['kind'], text: string, nodeId?: string, side?: Side) {
    // Ground taken and lost, and a brigade breaking, are seen by both armies.
    if (kind === 'capture' || kind === 'rout' || kind === 'wounded') this.tell('both', text);
    this.state.events.push({ id: `e${++this.seq}`, turn: this.state.turn, clock: this.state.clock, kind, text, nodeId, side });
    if (this.state.events.length > 60) this.state.events.splice(0, this.state.events.length - 60);
  }

  /** Shortest road route. With a side given, it steers around ground the enemy holds. */
  private pathTo(from: string, to: string, side?: Side): string[] {
    if (from === to) return [from];
    const dist = new Map<string, number>([[from, 0]]); const prev = new Map<string, string>(); const done = new Set<string>();
    for (;;) {
      let cur: string | null = null; let best = Infinity;
      for (const [n, d] of dist) if (!done.has(n) && d < best) { best = d; cur = n; }
      if (cur === null || cur === to) break;
      done.add(cur);
      for (const n of this.adj.get(cur) ?? []) {
        let cost = 1;
        if (side && n !== to) {
          if (this.at(n, other(side)).length) cost += 4;
          else if (this.control[n] === other(side)) cost += 1.5;
          else if (this.control[n] === side) cost -= 0.1;
        }
        const d = best + cost;
        if (d < (dist.get(n) ?? Infinity)) { dist.set(n, d); prev.set(n, cur); }
      }
    }
    if (!prev.has(to)) return [from];
    const p = [to]; let x = to; while (prev.has(x)) { x = prev.get(x)!; p.unshift(x); }
    return p;
  }
  private fallbackNode(u: Unit): string | null {
    let best: string | null = null; let bestD = Infinity;
    const here = Math.min(...BASES[u.side].map((b) => this.pathTo(u.nodeId, b).length));
    for (const n of this.adj.get(u.nodeId) ?? []) {
      if (this.at(n, other(u.side)).length) continue;
      const d = Math.min(...BASES[u.side].map((b) => this.pathTo(n, b).length));
      if (d < bestD) { bestD = d; best = n; }
    }
    return best && bestD <= here ? best : best;
  }

  private describeUnit(u: Unit) {
    const where = u.moving
      ? `on the march from ${this.nodeName(u.nodeId)} to ${this.nodeName(u.moving.to)}, about ${Math.round(u.moving.progress * 100)} per cent of the way (${u.moving.ground})`
      : `at ${this.nodeName(u.nodeId)}`;
    return `${u.name} (${u.strength} men, ${moraleWord(u.morale)}, ${fatigueWord(u.fatigue)}, ${ammoWord(u.ammo)}) ${where}${u.status === 'engaged' ? ', engaged' : ''}`;
  }

  /**
   * How many half hours a body of troops needs to get from one place to the next, and why.
   * A good road is quick; woods, boulders and slopes are slow; a stream has to be forded; tired
   * men march slower. One means it arrives within the half hour.
   */
  private marchCost(u: Unit, from: string, to: string): { cost: number; ground: string } {
    const e = EDGES.find((x) => (x.a === from && x.b === to) || (x.a === to && x.b === from));
    const a = this.node(from); const b = this.node(to);
    const pts: [number, number][] = [[a.x, a.y], ...((e?.via ?? []) as [number, number][]), [b.x, b.y]];
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const terrain: Record<string, [number, string]> = {
      open: [1, ''], farm: [1, ''], ridge: [1.1, 'up the ridge'], woods: [1.25, 'through woods'], rocks: [1.4, 'over boulders'], hill: [1.45, 'up a steep, rocky slope'],
    };
    const [terr, word] = terrain[b.terrain] ?? [1, ''];
    const tired = 1 + u.fatigue / 300;
    const cost = Math.max(0.45, len / 640) * (e?.road ? 0.7 : 1) * terr * tired + (e?.ford ? 0.15 : 0);
    const ground = [e?.road ? `by the ${e.road}` : 'across country', word, e?.ford ? `fording ${e.ford}` : '', tired > 1.2 ? 'the men tired' : ''].filter(Boolean).join(', ');
    return { cost, ground };
  }
  /** What a commander on this side can see: own troops, and the enemy within one road of them. */
  private situation(side: Side) {
    const own = this.state.units.filter((u) => u.side === side && u.strength > 0);
    const near = new Set<string>();
    for (const u of own) if (!u.inReserve) { near.add(u.nodeId); for (const n of this.adj.get(u.nodeId) ?? []) near.add(n); }
    for (const c of this.state.commanders) if (c.side === side) { near.add(c.nodeId); for (const n of this.adj.get(c.nodeId) ?? []) near.add(n); }
    const enemy = this.state.units.filter((u) => u.side !== side && this.alive(u) && near.has(u.nodeId));
    return {
      time: this.clockLabel(this.state.turn),
      hours_of_daylight_left: Math.max(0, ((this.state.maxTurns - this.state.turn) * BATTLE.turnMinutes) / 60),
      your_troops: own.filter((u) => !u.inReserve).map((u) => this.describeUnit(u)),
      in_reserve: own.filter((u) => u.inReserve).map((u) => `${u.name} (${u.strength} men) at ${this.nodeName(u.nodeId)}`),
      enemy_in_view: enemy.length ? enemy.map((u) => `${u.name} (about ${Math.round(u.strength / 100) * 100} men) at ${this.nodeName(u.nodeId)}`) : ['none in view'],
      ground: NODES.filter((n) => n.objective).map((n) => `${n.name}: ${this.holderWord(n.id)}`),
    };
  }
  private holderWord(nodeId: string) {
    if (this.contested(nodeId)) return 'being fought over';
    const h = this.control[nodeId];
    return h === 'empty' ? 'unoccupied' : h === 'union' ? 'held by the Union' : 'held by the Confederates';
  }
  private agentState(c: Commander, extra: Record<string, unknown> = {}) {
    const seed = this.cmeta.get(c.id)!.seed;
    return {
      battle: `${BATTLE.name}, ${BATTLE.date}`,
      you: {
        name: `${c.rank} ${c.name}`, command: c.role, background: seed.brief,
        ...(c.traits.length ? { character: c.traits.map((t) => t.text) } : {}),
      },
      standing_order: c.standingOrder ? `From ${c.standingOrder.fromName}: ${c.standingOrder.text}` : 'none',
      // What he has heard, as he would have heard it at the time: nothing says who or what chose it.
      news_from_the_field: this.news.filter((n) => n.side === c.side).slice(-8).map((n) => `${n.clock}: ${n.text}`),
      situation: this.situation(c.side),
      ...extra,
    };
  }

  // ------------------------------------------------------------ deciding

  private updateLedger(latencyMs: number, tokens: number, cost: number, count: number) {
    this.latencies.push(latencyMs);
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const l = this.state.ledger;
    l.decisions += count; l.inputTokens += tokens; l.costUsd += cost;
    l.medianMs = sorted[Math.floor(sorted.length / 2)] ?? 0;
    l.frontierCostUsd = l.decisions * FRONTIER_USD_PER_DECISION;
    l.frontierSeconds = l.decisions * FRONTIER_SECONDS_PER_DECISION;
  }

  /** Put one or more questions about the same state to the decider and record a Decision for each. */
  private async decide(spec: {
    agentId: string; agentName: string; side: Side; tier: Tier; commanderId?: string;
    state: any; traits?: Trait[]; dispatch?: boolean;
    questions: { q: Question; kind: DecisionKind; historical?: string; checkpoint?: string; unitId?: string; unitName?: string }[];
  }): Promise<Record<string, string>> {
    if (!spec.questions.length) return {};
    const flatten = this.state.personas ? 0 : 0.85;
    const req: AskRequest = { state: spec.state, questions: spec.questions.map((x) => x.q), mockFlatten: flatten };
    let res;
    try { res = await this.decider.ask(req); }
    catch (e) {
      console.error('[decide] failed:', (e as Error).message);
      this.event('note', `The decider did not answer for ${spec.agentName}: ${(e as Error).message.slice(0, 120)}`);
      // Fail visibly and safely: take the first option (always the "hold / obey" default), mark it.
      const out: Record<string, string> = {};
      for (const x of spec.questions) out[x.q.id] = x.q.options[0].id;
      return out;
    }
    this.updateLedger(res.latencyMs, res.inputTokens, res.costUsd, spec.questions.length);
    const human = spec.commanderId ? this.cmd(spec.commanderId)?.controlledBy : null;
    const out: Record<string, string> = {};
    const per = spec.questions.length;

    const waits = spec.questions.map(async (x) => {
      const a = res.answers[x.q.id];
      let chosen = a.chosen; let by: Decision['by'] = res.by; let wouldHave: string | undefined;
      if (human) {
        const pending: PendingChoice = {
          id: `p${++this.seq}`, commanderId: spec.commanderId!, kind: x.kind, question: x.q.instructions,
          options: a.options, unitId: x.unitId, unitName: x.unitName,
        };
        this.state.pending.push(pending); this.suggestions.set(pending.id, a.chosen); this.pendingQuestions.set(pending.id, x.q);
        this.emit();
        const picked = await new Promise<string>((resolve) => this.resolvers.set(pending.id, resolve));
        this.resolvers.delete(pending.id); this.suggestions.delete(pending.id); this.pendingQuestions.delete(pending.id);
        this.state.pending = this.state.pending.filter((p) => p.id !== pending.id);
        if (picked && picked !== a.chosen && a.options.some((o) => o.id === picked)) {
          wouldHave = a.options.find((o) => o.id === a.chosen)?.label; chosen = picked; by = 'human';
        } else if (picked === a.chosen && this.cmd(spec.commanderId!)?.controlledBy) { by = 'human'; }
      }
      const d: Decision = {
        id: `d${++this.seq}`, turn: this.state.turn, clock: this.state.clock, agentId: spec.agentId, agentName: spec.agentName,
        side: spec.side, tier: spec.tier, kind: x.kind, question: x.q.instructions, options: a.options, chosen, by,
        model: res.model, latencyMs: res.latencyMs, inputTokens: Math.round(res.inputTokens / per), costUsd: res.costUsd / per,
        historical: x.historical, matchesHistory: x.historical ? x.historical === chosen : undefined,
        unitId: x.unitId, wouldHave, explainable: !!(spec.traits && spec.traits.length),
      };
      const label = a.options.find((o) => o.id === chosen)?.label ?? chosen;
      d.dispatch = x.unitName ? `${x.unitName}: ${label}.` : `${label}.`;
      this.askLog.set(d.id, { state: spec.state, question: x.q, traits: spec.traits ?? [] });
      this.allDecisions.push(d); this.state.decisions.push(d);
      // Keep every command decision for the whole battle; trim only the oldest routine brigade traffic.
      if (this.state.decisions.length > 260) {
        const i = this.state.decisions.findIndex((y) => (y.kind === 'order' || y.kind === 'reaction') && !y.historical);
        this.state.decisions.splice(i >= 0 ? i : 0, 1);
      }
      if (x.checkpoint) this.scoreCheckpoint(x.checkpoint, d, label);
      if (spec.dispatch && !x.unitId) {
        writeDispatch({ name: spec.agentName, question: x.q.instructions, chosen: `${label} (${a.options.find((o) => o.id === chosen)?.description ?? ''})`, clock: this.clockLabel(this.state.turn), traits: (spec.traits ?? []).map((t) => t.label) })
          .then((line) => { if (line) { d.dispatch = line; this.emit(); } }).catch(() => {});
      }
      out[x.q.id] = chosen;
    });
    await Promise.all(waits);
    this.emit();
    return out;
  }
  private pendingQuestions = new Map<string, Question>();

  private scoreCheckpoint(id: string, d: Decision, label: string) {
    const cp = this.state.fidelity.checkpoints.find((c) => c.id === id);
    if (!cp || cp.decisionId) return;
    cp.decisionId = d.id; cp.actualLabel = label; cp.matched = !!d.matchesHistory; cp.turn = d.turn;
    const done = this.state.fidelity.checkpoints.filter((c) => c.decisionId);
    this.state.fidelity.decided = done.length;
    this.state.fidelity.matched = done.filter((c) => c.matched).length;
  }

  private opt(id: string, label: string, description: string, mock = 1): QOption { return { id, label, description, mock }; }

  private courier(kind: Courier['kind'], fromId: string, toId: string, text: string, turns = 1) {
    const from = this.cmd(fromId)?.nodeId ?? this.unit(fromId)?.nodeId; const to = this.cmd(toId)?.nodeId ?? this.unit(toId)?.nodeId;
    if (!from || !to) return;
    this.state.couriers.push({
      id: `c${++this.seq}`, kind, fromId, toId, path: this.pathTo(from, to), departTurn: this.state.turn,
      arriveTurn: this.state.turn + turns, text, delivered: false,
    });
  }

  private giveOrder(fromId: string, toId: string, objective: keyof typeof OBJECTIVES) {
    const from = this.cmd(fromId); const to = this.cmd(toId); const m = this.cmeta.get(toId)!;
    to.standingOrder = { fromId, fromName: from.name.split(' ').pop()!, text: OBJECTIVES[objective].text, issuedTurn: this.state.turn, receivedTurn: this.state.turn };
    m.orderObjective = objective; m.complied = false; m.delays = 0; to.compliance = undefined;
    this.courier('order', fromId, toId, OBJECTIVES[objective].text);
  }

  private complianceQuestion(c: Commander, allow: Compliance[], mock: Partial<Record<Compliance, number>>, deviateText: string): Question {
    const all: Record<Compliance, QOption> = {
      obey: this.opt('obey', 'Obeys the order', 'Carry out the order as given, at once.', mock.obey),
      delay: this.opt('delay', 'Delays', 'Intend to obey, but wait this half hour until better prepared.', mock.delay),
      protest: this.opt('protest', 'Protests', 'Send to the superior asking that the order be changed, and wait for the answer.', mock.protest),
      deviate: this.opt('deviate', 'Acts on his own judgement', deviateText, mock.deviate),
    };
    return {
      id: 'compliance',
      instructions: `How does ${c.rank} ${c.name} respond to the standing order from his superior?`,
      options: allow.map((k) => all[k]),
    };
  }

  // ------------------------------------------------------------ the turn

  async step(): Promise<void> {
    if (this.running || this.state.phase === 'ended') return;
    this.running = true;
    try {
      const s = this.state; const t = s.turn;
      s.phase = 'deciding';
      s.couriers = s.couriers.filter((c) => c.arriveTurn >= t);
      for (const c of s.couriers) if (c.arriveTurn <= t) c.delivered = true;
      for (const u of s.units) { u.prevNodeId = u.nodeId; this.umeta.get(u.id)!.movedInto = undefined; }
      this.emit();

      await Promise.all([this.leePhase(t), this.meadePhase(t), this.warrenPhase(t)]);
      await this.deviationRulings(t);
      await Promise.all([this.longstreetPhase(t), this.sicklesPhase(t)]);
      await this.hoodPhase(t);
      await Promise.all(['lee', 'longstreet', 'hood', 'sickles'].map((id) => this.ordersFor(id, t)));
      this.callResponders(t);

      s.phase = 'resolving';
      this.moveUnits();
      this.emit();
      await sleep(this.state.auto ? 900 : 400);
      await this.reactions(t);
      this.resolveCombat(t);
      this.afterCombat(t);

      s.turn = t + 1; s.clock = this.clockAt(s.turn);
      this.refreshObjectives();
      // Past dusk the battle goes on only until it is decided: one side holds every key position,
      // one side can no longer fight, or both stand still for an hour.
      const active = NODES.some((n) => this.contested(n.id)) || s.units.some((u) => this.alive(u) && (u.moving || this.umeta.get(u.id)!.destination));
      this.quiet = active ? 0 : this.quiet + 1;
      let over = s.turn >= s.maxTurns;
      if (s.extended && !over && (this.assess().decided || this.quiet >= 2)) over = true;
      if (over) { s.phase = 'ended'; s.auto = false; this.endOfDay(); } else s.phase = 'ready';
      this.save();
      this.emit();
    } catch (e) {
      console.error('[step] error', e);
      this.event('note', `Engine error: ${(e as Error).message}`);
      this.state.phase = 'ready'; this.emit();
    } finally { this.running = false; }
  }

  private async leePhase(t: number) {
    const lee = this.cmd('lee'); const m = this.cmeta.get('lee')!;
    // Drex's Lee sets the plan once, as Lee did. A player holding Lee may review it every half hour.
    if (m.objective && (!lee.controlledBy || lee.status !== 'active')) return;
    const first = !m.objective;
    const current = m.objective as keyof typeof OBJECTIVES | undefined;
    const q: Question = first
      ? {
          id: 'objective',
          instructions: 'What does General Lee order the First Corps to do against the Union left this afternoon?',
          options: [
            this.opt('emmitsburg_road', OBJECTIVES.emmitsburg_road.label, OBJECTIVES.emmitsburg_road.text, 6),
            this.opt('flank_round_tops', OBJECTIVES.flank_round_tops.label, OBJECTIVES.flank_round_tops.text + ' General Longstreet has urged this.', 1.4),
            this.opt('await', OBJECTIVES.await.label, OBJECTIVES.await.text, 0.5),
          ],
        }
      : {
          id: 'objective',
          instructions: `It is ${this.clockLabel(t)}. The First Corps is under orders to ${OBJECTIVES[current!].label.toLowerCase()}. Does General Lee keep the plan or change it?`,
          options: [
            this.opt(current!, `Keep the plan: ${OBJECTIVES[current!].label.toLowerCase()}`, `Let the attack go on as ordered: ${OBJECTIVES[current!].text}`, 6),
            ...(['emmitsburg_road', 'flank_round_tops'] as const).filter((k) => k !== current).map((k) => this.opt(k, `Change to: ${OBJECTIVES[k].label.toLowerCase()}`, OBJECTIVES[k].text, 0.6)),
            ...(current !== 'await' ? [this.opt('await', 'Halt the attack', 'Stop the First Corps where it stands and await developments.', 0.4)] : []),
          ],
        };
    const r = await this.decide({
      agentId: 'lee', agentName: lee.name, side: lee.side, tier: 'army', commanderId: 'lee', dispatch: true, traits: lee.traits,
      state: this.agentState(lee, { note: first ? "Longstreet's two divisions are coming into position on the right, opposite the enemy's left." : 'Reports from the right are coming in.' }),
      questions: [{ q, kind: 'objective', historical: first ? 'emmitsburg_road' : undefined, checkpoint: first ? 'lee_objective' : undefined }],
    });
    const pick = r.objective as keyof typeof OBJECTIVES;
    lee.intent = OBJECTIVES[pick].label;
    if (pick !== current) this.tell('confederate', `Lee orders the First Corps to ${OBJECTIVES[pick].label.toLowerCase()}.`);
    if (first && pick === 'await') { m.objective = undefined; return; } // he will be asked again next half hour
    if (pick === current) return;
    m.objective = pick;
    this.giveOrder('lee', 'longstreet', pick);
    if (!first) this.event('note', `Lee changes the plan: ${OBJECTIVES[pick].label.toLowerCase()}. A courier rides to Longstreet.`, lee.nodeId, 'confederate');
  }

  private async longstreetPhase(t: number) {
    const c = this.cmd('longstreet'); const m = this.cmeta.get('longstreet')!;
    if (c.status !== 'active' || !c.standingOrder || m.complied) return;
    const allow: Compliance[] = m.delays >= 1 ? ['obey', 'protest', 'deviate'] : ['obey', 'delay', 'protest', 'deviate'];
    const wantsFlank = m.orderObjective === 'emmitsburg_road';
    const q = this.complianceQuestion(c, m.protests >= 1 ? allow.filter((a) => a !== 'protest') : allow,
      wantsFlank ? { obey: 5, delay: 2, protest: 1.6, deviate: 0.3 } : { obey: 7, delay: 1, protest: 0.3, deviate: 0.2 },
      wantsFlank ? 'Set the order aside and move the corps around the Round Tops instead.' : 'Set the order aside and attack straight up the Emmitsburg Road instead.');
    const r = await this.decide({
      agentId: c.id, agentName: c.name, side: c.side, tier: 'corps', commanderId: c.id, dispatch: true, traits: c.traits,
      state: this.agentState(c), questions: [{ q, kind: 'compliance', historical: 'obey', checkpoint: 'longstreet_obeys' }],
    });
    c.compliance = r.compliance as Compliance;
    const alt = wantsFlank ? 'flank_round_tops' : 'emmitsburg_road';
    if (c.compliance === 'obey') { m.objective = m.orderObjective; m.complied = true; this.tell('confederate', `Longstreet puts the First Corps in motion to ${OBJECTIVES[m.orderObjective as keyof typeof OBJECTIVES].label.toLowerCase()}.`); }
    else if (c.compliance === 'deviate') {
      m.objective = alt; m.complied = true;
      this.tell('confederate', `Longstreet sets Lee's order aside and will ${OBJECTIVES[alt].label.toLowerCase()} instead.`);
      this.deviations.push({ subId: 'longstreet', superiorId: 'lee', original: m.orderObjective as keyof typeof OBJECTIVES, chosen: alt, turn: t });
    }
    else if (c.compliance === 'delay') { m.delays++; c.intent = 'Waiting until the corps is closed up'; this.tell('confederate', 'Longstreet holds the First Corps back, waiting until it is closed up.'); return; }
    else {
      m.protests++;
      const granted = await this.ruling('lee', c, `General Longstreet asks leave to ${OBJECTIVES[alt].label.toLowerCase()} instead of the order given.`, { deny: 6, grant: 1 });
      m.objective = granted ? alt : m.orderObjective; m.complied = true; c.compliance = granted ? 'obey' : 'obey';
    }
    c.intent = OBJECTIVES[m.objective as keyof typeof OBJECTIVES].label;
    this.giveOrder('longstreet', 'hood', m.objective as keyof typeof OBJECTIVES);
  }

  private async hoodPhase(t: number) {
    const c = this.cmd('hood'); const m = this.cmeta.get('hood')!;
    if (c.status !== 'active' || !c.standingOrder || m.complied) return;
    const road = m.orderObjective === 'emmitsburg_road';
    const q = this.complianceQuestion(c, ['obey', 'protest', 'deviate'],
      road ? { obey: 2.4, protest: 5, deviate: 0.9 } : { obey: 7, protest: 0.4, deviate: 0.2 },
      road ? 'Set the order aside and take the division around the Round Tops into the enemy rear.' : 'Set the order aside and attack straight up the Emmitsburg Road.');
    const r = await this.decide({
      agentId: c.id, agentName: c.name, side: c.side, tier: 'corps', commanderId: c.id, dispatch: true, traits: c.traits,
      state: this.agentState(c, { scouts_report: 'The enemy left rests on Round Top. The country beyond it is open, with his wagon trains parked behind. The ground in front, at the Devil\'s Den, is all boulders.' }),
      questions: [{ q, kind: 'compliance', historical: road ? 'protest' : undefined, checkpoint: road ? 'hood_protests' : undefined }],
    });
    c.compliance = r.compliance as Compliance;
    const alt = road ? 'flank_round_tops' : 'emmitsburg_road';
    if (c.compliance === 'protest') {
      m.protests++;
      const granted = await this.ruling('longstreet', c, `General Hood asks leave to ${OBJECTIVES[alt].label.toLowerCase()}: his scouts report the way around Round Top open.`, { deny: 6, grant: 1 }, road ? 'longstreet_denies' : undefined);
      if (granted) { m.objective = alt; }
      else {
        const q2: Question = {
          id: 'after_refusal', instructions: `His protest refused, what does ${c.rank} ${c.name} do?`,
          options: [this.opt('obey', 'Obeys the order', 'Carry out the order as given.', 6), this.opt('deviate', 'Acts on his own judgement', 'Disregard the refusal and go around the Round Tops.', 0.8)],
        };
        const r2 = await this.decide({
          agentId: c.id, agentName: c.name, side: c.side, tier: 'corps', commanderId: c.id, dispatch: true, traits: c.traits,
          state: this.agentState(c, { reply_from_Longstreet: 'We must obey the orders of General Lee.' }), questions: [{ q: q2, kind: 'compliance' }],
        });
        c.compliance = r2.after_refusal as Compliance;
        m.objective = c.compliance === 'deviate' ? alt : m.orderObjective;
      }
    } else m.objective = c.compliance === 'deviate' ? alt : m.orderObjective;
    m.complied = true; c.intent = OBJECTIVES[m.objective as keyof typeof OBJECTIVES].label;
    if (c.compliance === 'deviate') {
      this.tell('confederate', `Hood disregards his orders and takes his division to ${OBJECTIVES[alt].label.toLowerCase()}.`);
      this.deviations.push({ subId: 'hood', superiorId: 'longstreet', original: m.orderObjective as keyof typeof OBJECTIVES, chosen: alt, turn: t });
    } else this.tell('confederate', `Hood's division goes in to ${OBJECTIVES[m.objective as keyof typeof OBJECTIVES].label.toLowerCase()}.`);
  }

  /**
   * Word that a subordinate set his order aside reaches his superior the next half hour, and the
   * superior, in his own character, either lets it stand or orders him back to the plan.
   */
  private async deviationRulings(t: number) {
    const due = this.deviations.filter((d) => d.turn < t);
    this.deviations = this.deviations.filter((d) => d.turn >= t);
    for (const d of due) {
      const sup = this.cmd(d.superiorId); const sub = this.cmd(d.subId);
      if (!sup || !sub || sup.status !== 'active') continue;
      const q: Question = {
        id: 'deviation',
        instructions: `Word reaches ${sup.rank} ${sup.name}: ${sub.rank} ${sub.name} has set aside his order to ${OBJECTIVES[d.original].label.toLowerCase()} and is acting on his own judgement, to ${OBJECTIVES[d.chosen].label.toLowerCase()}. What does ${sup.name.split(' ').pop()} do?`,
        options: [
          this.opt('recall', 'Orders him back to the plan', `Send a peremptory order: ${OBJECTIVES[d.original].text}`, 4),
          this.opt('accept', 'Lets it stand', `Accept what is done and support him: ${OBJECTIVES[d.chosen].text}`, 1.5),
        ],
      };
      const r = await this.decide({
        agentId: sup.id, agentName: sup.name, side: sup.side, tier: sup.tier, commanderId: sup.id, dispatch: true, traits: sup.traits,
        state: this.agentState(sup, { report_received: `${sub.name} has disregarded his orders.` }), questions: [{ q, kind: 'protest_ruling' }],
      });
      if (r.deviation === 'recall') {
        this.courier('order', sup.id, sub.id, `You will ${OBJECTIVES[d.original].label.toLowerCase()} as ordered.`);
        this.giveOrder(sup.id, sub.id, d.original);
        for (const u of this.state.units) if (u.commanderId === sub.id) this.umeta.get(u.id)!.route = 0;
        this.tell(sup.side, `${sup.name.split(' ').pop()} orders ${sub.name.split(' ').pop()} back to the plan.`);
      } else {
        if (sup.id === 'lee') this.cmeta.get('lee')!.objective = d.chosen;
        this.tell(sup.side, `${sup.name.split(' ').pop()} lets ${sub.name.split(' ').pop()}'s change stand.`);
      }
    }
  }

  /** A superior rules on a subordinate's protest. Returns true if granted. */
  private async ruling(superiorId: string, sub: Commander, request: string, mock: { deny: number; grant: number }, checkpoint?: string) {
    const sup = this.cmd(superiorId);
    this.courier('protest', sub.id, superiorId, request);
    const q: Question = {
      id: 'ruling', instructions: `${sub.rank} ${sub.name} protests his order. ${request} Does ${sup.rank} ${sup.name} grant the request?`,
      options: [this.opt('deny', 'Refuses: the order stands', 'Refuse the request; the order is to be carried out as given.', mock.deny), this.opt('grant', 'Grants the request', 'Change the order as the subordinate asks.', mock.grant)],
    };
    const r = await this.decide({
      agentId: sup.id, agentName: sup.name, side: sup.side, tier: sup.tier, commanderId: sup.id, dispatch: true, traits: sup.traits,
      state: this.agentState(sup, { request_received: request }), questions: [{ q, kind: 'protest_ruling', historical: checkpoint ? 'deny' : undefined, checkpoint }],
    });
    this.courier('reply', superiorId, sub.id, r.ruling === 'grant' ? 'Request granted.' : 'The order stands.');
    this.tell(sup.side, `${sub.name.split(' ').pop()} protests his orders; ${sup.name.split(' ').pop()} ${r.ruling === 'grant' ? 'grants the change' : 'refuses: the order stands'}.`);
    return r.ruling === 'grant';
  }

  private async sicklesPhase(t: number) {
    const c = this.cmd('sickles'); const m = this.cmeta.get('sickles')!;
    if (c.status !== 'active' || !c.standingOrder || m.complied) return;
    const toHold = m.orderObjective === 'hold_ridge';
    const allow: Compliance[] = (m.delays >= 1 ? ['obey', 'protest', 'deviate'] : ['obey', 'delay', 'protest', 'deviate']).filter((a) => !(a === 'protest' && m.protests >= 1)) as Compliance[];
    const recalled = !!m.flags.recalled;
    const q = this.complianceQuestion(c, allow,
      recalled ? { obey: 3, delay: 1, protest: 2, deviate: 2.5 } : { obey: 1.4, delay: 1, protest: 2, deviate: 5 },
      toHold ? 'Without orders, advance the corps to the higher ground at the Peach Orchard and the Emmitsburg Road.' : 'Fall back to Cemetery Ridge on his own judgement.');
    const r = await this.decide({
      agentId: c.id, agentName: c.name, side: c.side, tier: 'corps', commanderId: c.id, dispatch: true, traits: c.traits,
      state: this.agentState(c, { ground: 'Your assigned line is low and overlooked by the Peach Orchard, three quarters of a mile to your front, which is higher and open. Enemy skirmishers have been found in the woods beyond it.' }),
      questions: [{ q, kind: 'compliance', historical: recalled ? undefined : 'deviate', checkpoint: recalled ? undefined : 'sickles_advance' }],
    });
    c.compliance = r.compliance as Compliance;
    const alt = toHold ? 'advance_salient' : 'hold_ridge';
    if (c.compliance === 'delay') { m.delays++; c.intent = 'Waiting on his present ground'; this.tell('union', 'Sickles has not yet taken up the line he was given.'); return; }
    if (c.compliance === 'protest') {
      m.protests++;
      const granted = await this.ruling('meade', c, `General Sickles asks leave to ${OBJECTIVES[alt].label.toLowerCase()}.`, { deny: 4, grant: 1.5 });
      m.objective = granted ? alt : m.orderObjective; c.compliance = 'obey';
    } else m.objective = c.compliance === 'deviate' ? alt : m.orderObjective;
    m.complied = true; c.intent = OBJECTIVES[m.objective as keyof typeof OBJECTIVES].label;
    if (m.objective === 'advance_salient') {
      c.nodeId = 'trostle';
      this.event('note', 'The III Corps leaves Cemetery Ridge and marches for the Peach Orchard, colours flying.', 'cemetery_ridge_s', 'union');
      this.tell('both', 'The III Corps leaves Cemetery Ridge and advances to the Peach Orchard and the Emmitsburg Road.');
    } else { c.nodeId = 'cemetery_ridge_s'; this.tell('union', 'Sickles holds the III Corps on Cemetery Ridge, as ordered.'); }
  }

  private async meadePhase(t: number) {
    const c = this.cmd('meade'); const m = this.cmeta.get('meade')!; const sm = this.cmeta.get('sickles')!;
    if (c.status !== 'active') return;
    const questions: Parameters<Game['decide']>[0]['questions'] = [];
    if (sm.objective === 'advance_salient' && !m.flags.sawSalient && t >= 1) {
      m.flags.sawSalient = true;
      questions.push({
        kind: 'objective', historical: 'support', checkpoint: 'meade_supports',
        q: {
          id: 'salient', instructions: 'General Meade rides out and finds the III Corps three quarters of a mile in front of the line he ordered, with the enemy forming opposite. What does he do?',
          options: [
            this.opt('support', 'Reinforces Sickles where he stands', 'Judge it too late to withdraw the corps; leave it and send the reserves to support it.', 5),
            this.opt('withdraw', 'Orders Sickles back to the ridge', 'Order the III Corps to fall back at once to Cemetery Ridge.', 1.5),
            this.opt('leave', 'Keeps his reserves on the ridge', 'Leave the III Corps to its fate and keep the reserves on the main line.', 0.6),
          ],
        },
      });
    }
    const reserves = this.state.units.filter((u) => u.side === 'union' && u.inReserve && u.id !== 'maine20' && (u.commanderId === 'meade' || t >= 3));
    const press = (n: string) => {
      const ours = this.at(n, 'union').reduce((a, u) => a + u.strength, 0);
      const theirs = this.at(n, 'confederate').reduce((a, u) => a + u.strength, 0);
      const coming = (this.adj.get(n) ?? []).flatMap((x) => this.at(x, 'confederate')).filter((u) => this.umeta.get(u.id)!.destination === n).reduce((a, u) => a + u.strength, 0);
      const round = (x: number) => Math.round(x / 100) * 100;
      if (theirs && ours) return `under attack: our ${round(ours)} men against about ${round(theirs)}`;
      if (theirs) return `in the enemy's hands, about ${round(theirs)} men`;
      if (ours && coming) return `held by our ${round(ours)} men, with about ${round(coming)} of the enemy advancing on it`;
      if (ours) return `held by our ${round(ours)} men, not yet attacked`;
      return coming ? `unoccupied, with about ${round(coming)} of the enemy advancing on it` : 'unoccupied and quiet';
    };
    const reports = RESERVE_TARGETS.map((n) => `${this.nodeName(n)}: ${press(n)}`);
    if (t >= 1) for (const u of reserves) {
      const seed = this.umeta.get(u.id)!.seed; const due = t >= (seed.hintTurn ?? 99);
      const hint = seed.hintTarget ?? 'little_round_top';
      questions.push({
        kind: 'reinforcement', unitId: u.id, unitName: u.name,
        q: {
          id: `res_${u.id}`, instructions: `Where does General Meade send ${u.name} (${u.strength} men, in reserve at ${this.nodeName(u.nodeId)}) this half hour?`,
          options: [
            this.opt('stay', 'Kept in reserve', 'No point on the line needs it yet: keep it in hand.', due ? 0.6 : 5),
            ...RESERVE_TARGETS.map((n) => this.opt(n, `To ${this.node(n).short}`, `March it to ${this.nodeName(n)}, which is ${press(n)}.`, n === hint ? (due ? 5 : 0.3) : 0.25)),
          ],
        },
      });
    }
    if (!questions.length) return;
    const r = await this.decide({
      agentId: c.id, agentName: c.name, side: c.side, tier: 'army', commanderId: c.id, dispatch: true, traits: c.traits,
      state: this.agentState(c, {
        sickles: sm.objective === 'advance_salient' ? 'The III Corps has advanced to the Peach Orchard without orders.' : 'The III Corps is on Cemetery Ridge.',
        reports_from_the_left: reports,
        your_reserve: 'The V Corps and part of the II Corps are in hand to be sent wherever the line is threatened.',
      }),
      questions,
    });
    if (r.salient) {
      c.intent = r.salient === 'support' ? 'Feeding the reserves to the left' : r.salient === 'withdraw' ? 'Recalling the III Corps' : 'Holding the main line';
      this.tell('union', r.salient === 'support' ? 'Meade leaves the III Corps where it stands and sends the reserves to support it.' : r.salient === 'withdraw' ? 'Meade orders the III Corps back to Cemetery Ridge.' : 'Meade keeps his reserves on the main line.');
      if (r.salient === 'withdraw') { sm.flags.recalled = true; this.giveOrder('meade', 'sickles', 'hold_ridge'); }
      m.flags.noSupport = r.salient === 'leave';
    }
    for (const u of reserves) {
      const target = r[`res_${u.id}`];
      if (!target || target === 'stay') continue;
      this.release(u, target, `${u.name} is ordered to ${this.nodeName(target)}.`);
      this.tell('union', `Meade sends ${u.name} to ${this.nodeName(target)}.`);
      if (u.id === 'vincent') this.release(this.unit('maine20'), target);
    }
  }

  private release(u: Unit, target: string, note?: string) {
    if (!u.inReserve) return;
    u.inReserve = false; u.status = 'marching'; this.umeta.get(u.id)!.destination = target;
    u.order = { type: 'march', target, label: `March to ${this.node(target).short}` };
    if (note) this.event('arrival', note, u.nodeId, u.side);
  }

  private async warrenPhase(t: number) {
    const c = this.cmd('warren'); const m = this.cmeta.get('warren')!;
    if (c.status !== 'active') return;
    if (m.flags.riding) { c.nodeId = 'little_round_top'; m.flags.riding = false; m.flags.onHill = true; this.event('note', 'Warren reaches the signal station on Little Round Top.', 'little_round_top', 'union'); }
    if (t === 0 && !m.flags.asked) {
      m.flags.asked = true;
      const q: Question = {
        id: 'ride', instructions: 'Firing is heard toward the left of the army. What does General Warren do?',
        options: [
          this.opt('ride_to_lrt', 'Rides to Little Round Top', 'Ride to the rocky hill at the left end of the line to see how it is held.', 5),
          this.opt('stay_hq', 'Stays at headquarters', 'Remain with General Meade at headquarters.', 1),
          this.opt('inspect_centre', 'Inspects the centre', 'Ride along the centre of Cemetery Ridge.', 0.9),
        ],
      };
      const r = await this.decide({
        agentId: c.id, agentName: c.name, side: c.side, tier: 'corps', commanderId: c.id, dispatch: true, traits: c.traits,
        state: this.agentState(c), questions: [{ q, kind: 'objective', historical: 'ride_to_lrt', checkpoint: 'warren_rides' }],
      });
      if (r.ride === 'ride_to_lrt') { c.nodeId = 'cemetery_ridge_s'; m.flags.riding = true; c.intent = 'Riding to the left'; }
      else c.intent = r.ride === 'stay_hq' ? 'With Meade' : 'On the ridge';
      return;
    }
    if (m.flags.onHill && !m.flags.called && this.at('little_round_top', 'union').length === 0) {
      m.flags.called = true;
      const q: Question = {
        id: 'call', instructions: 'General Warren finds Little Round Top held by nothing but a signal station, and sees the glint of enemy bayonets in the woods beyond the Emmitsburg Road, overlapping the Union left. What does he do?',
        options: [
          this.opt('send_for_troops', 'Sends at once for troops', 'Send his aides to bring the nearest brigades to the hill immediately, on his own authority.', 6),
          this.opt('report_to_meade', 'Reports to Meade and waits', 'Send a written report to General Meade and wait for his decision.', 1.2),
          this.opt('keep_watching', 'Keeps observing', 'Stay and observe; it is not his place to move troops.', 0.4),
        ],
      };
      const r = await this.decide({
        agentId: c.id, agentName: c.name, side: c.side, tier: 'corps', commanderId: c.id, dispatch: true, traits: c.traits,
        state: this.agentState(c), questions: [{ q, kind: 'reinforcement', historical: 'send_for_troops', checkpoint: 'warren_calls' }],
      });
      this.tell('union', r.call === 'send_for_troops' ? 'Warren finds Little Round Top empty and sends for troops to hold it.' : 'Warren is watching the left from Little Round Top.');
      if (r.call === 'send_for_troops') { m.flags.callTurn = t; c.intent = 'Calling for troops'; this.courier('request', 'warren', 'vincent', 'Troops are wanted on Little Round Top at once.'); }
      else c.intent = 'Watching from the hill';
    }
  }

  /** Brigades answer Warren's call for themselves. */
  private callResponders(t: number) { /* decisions are async; handled in reactions() to keep the turn order simple */ }

  private async answerCalls(t: number) {
    const m = this.cmeta.get('warren')!;
    if (typeof m.flags.callTurn !== 'number') return;
    const candidates = [this.unit('vincent'), this.unit('weed')].filter((u) => u.inReserve && t >= (m.flags.callTurn as number) + (u.id === 'weed' ? 3 : 0));
    await Promise.all(candidates.map(async (u) => {
      const q: Question = {
        id: 'answer', instructions: `A staff officer from General Warren reaches ${u.leader}: troops are wanted on Little Round Top at once. His division commander has given no order. What does he do?`,
        options: [
          this.opt('answer_call', 'Takes the brigade up at once', 'Take the brigade to the hill immediately on his own responsibility.', 5),
          this.opt('await_orders', 'Waits for orders', 'Wait for an order from his own division commander.', 1.5),
        ],
      };
      const r = await this.decide({
        agentId: u.id, agentName: u.leader, side: u.side, tier: 'brigade',
        state: { battle: `${BATTLE.name}, ${BATTLE.date}`, you: { name: u.leader, command: u.name }, situation: { time: this.clockLabel(t), brigade: this.describeUnit(u), message: 'Little Round Top, the hill at the left end of the army, is unoccupied and the enemy is advancing on it.' } },
        questions: [{ q, kind: 'reinforcement', unitId: u.id, unitName: u.name, historical: u.id === 'vincent' ? 'answer_call' : undefined, checkpoint: u.id === 'vincent' ? 'vincent_answers' : undefined }],
      });
      if (r.answer === 'answer_call') {
        this.release(u, 'little_round_top', `${u.name} turns off the road and climbs Little Round Top.`);
        if (u.id === 'vincent') { this.release(this.unit('maine20'), 'little_round_top'); this.cmd('chamberlain').intent = 'Marching for the hill'; }
      }
    }));
  }

  /**
   * A commander's orders to his brigades. Only two things are his to judge here: when to commit a
   * brigade that is still in hand, and whether one that has taken its ground pushes on. A brigade
   * already marching keeps marching, and one in contact answers for itself (see reactions).
   */
  private async ordersFor(cmdId: string, t: number) {
    const c = this.cmd(cmdId); const m = this.cmeta.get(cmdId)!;
    const objective = m.objective;
    const mine = this.state.units.filter((u) => u.commanderId === cmdId && this.fighting(u) && u.status !== 'spent' && !u.agentId);
    if (!mine.length || !objective) return;
    const questions: Parameters<Game['decide']>[0]['questions'] = [];
    const auto: [Unit, string][] = [];
    for (const u of mine) {
      const um = this.umeta.get(u.id)!; const route = um.seed.sectors[objective] ?? [];
      if (this.contested(u.nodeId) || um.destination) continue;
      while (um.route < route.length && u.nodeId === route[um.route]) um.route++;
      const target = route[um.route];
      if (!target) continue;
      const fresh = um.route === 0 && um.engagedTurns === 0;
      const enemyThere = this.at(target, other(u.side)).length > 0;
      const due = t >= (um.seed.hintTurn ?? 0);
      const human = !!c.controlledBy && c.status === 'active';
      // Union brigades taking up an assigned line simply march to it, unless a player holds the commander.
      if (!um.seed.echelon && !human) { auto.push([u, target]); continue; }
      if (!um.seed.echelon) {
        questions.push({
          kind: 'order', unitId: u.id, unitName: u.name,
          q: {
            id: `ord_${u.id}`,
            instructions: `${u.name} (${u.strength} men) is at ${this.nodeName(u.nodeId)}. Its place in the line is ${this.nodeName(target)} (${this.holderWord(target)}). What are its orders this half hour?`,
            options: [
              this.opt(`advance:${target}`, `${u.short} to ${this.node(target).short}`, `March it to ${this.nodeName(target)}.`, 5),
              this.opt('hold', `${u.short} holds`, `Keep it at ${this.nodeName(u.nodeId)}.`, 1),
            ],
          },
        });
        continue;
      }
      if (c.status !== 'active') { if (fresh ? this.rightEngaged(um.seed.echelon) : true) auto.push([u, target]); continue; }
      const here = this.node(u.nodeId).short;
      if (fresh) {
        const right = this.state.units.find((x) => this.umeta.get(x.id)!.seed.echelon === um.seed.echelon! - 1);
        const rm = right ? this.umeta.get(right.id)! : null;
        const rightState = !right ? 'It is the right-hand brigade and leads the attack.'
          : rm!.engagedTurns > 0 || right.status === 'engaged' ? `The brigade on its right, ${right.name}, is engaged.`
          : right.nodeId !== rm!.seed.nodeId ? `The brigade on its right, ${right.name}, has stepped off and is closing with the enemy.`
          : `The brigade on its right, ${right.name}, has not yet stepped off.`;
        questions.push({
          kind: 'order', unitId: u.id, unitName: u.name,
          q: {
            id: `ord_${u.id}`,
            instructions: `The attack is made by brigades in succession from the right, each stepping off once the brigade on its right is engaged. ${u.name} (${u.strength} men, ${fatigueWord(u.fatigue)}) waits at ${this.nodeName(u.nodeId)}, number ${um.seed.echelon} in the order. ${rightState} Does ${c.rank} ${c.name} send it in this half hour?`,
            options: [
              this.opt('hold', `Hold ${u.short} back`, 'Its turn has not come: keep it in hand this half hour.', due ? 0.8 : 5),
              this.opt(`advance:${target}`, `Send ${u.short} in`, `Its turn has come: send it forward now against ${this.nodeName(target)} (${this.holderWord(target)}).`, due ? 5 : 0.4),
            ],
          },
        });
      } else {
        questions.push({
          kind: 'order', unitId: u.id, unitName: u.name,
          q: {
            id: `ord_${u.id}`,
            instructions: `${u.name} (${u.strength} of ${u.strength0} men, ${moraleWord(u.morale)}, ${ammoWord(u.ammo)}) holds ${this.nodeName(u.nodeId)}. Its next objective is ${this.nodeName(target)} (${this.holderWord(target)}). What does ${c.rank} ${c.name} order?`,
            options: [
              this.opt('hold', `Consolidate at ${here}`, `Hold ${this.nodeName(u.nodeId)} and go no farther this half hour.`, u.morale > 50 ? 1.5 : 4),
              this.opt(`advance:${target}`, `Push on to ${this.node(target).short}`, `Press on at once ${enemyThere ? 'and attack the enemy at' : 'to'} ${this.nodeName(target)}.`, u.morale > 50 ? 4 : 1),
            ],
          },
        });
      }
    }
    const send = (u: Unit, target: string) => {
      this.umeta.get(u.id)!.destination = target;
      const attack = this.at(target, other(u.side)).length > 0;
      u.order = { type: attack ? 'attack' : 'march', target, label: `${attack ? 'Attack' : 'March on'} ${this.node(target).short}` };
    };
    for (const [u, target] of auto) send(u, target);
    if (!questions.length) return;
    const r = await this.decide({
      // A player holding the commander gives these orders himself, on one sheet each half hour.
      agentId: c.id, agentName: c.name, side: c.side, tier: c.tier, traits: c.traits,
      commanderId: c.controlledBy ? c.id : undefined,
      state: this.agentState(c, { your_intention: OBJECTIVES[objective as keyof typeof OBJECTIVES].text }), questions,
    });
    for (const u of mine) {
      const pick = r[`ord_${u.id}`]; if (!pick) continue;
      if (pick === 'hold') u.order = { type: 'hold', label: `Hold at ${this.node(u.nodeId).short}` };
      else send(u, pick.split(':')[1]);
    }
  }
  private rightEngaged(echelon: number) {
    return this.state.units.some((u) => (this.umeta.get(u.id)!.seed.echelon ?? 99) < echelon && (u.status === 'engaged' || this.umeta.get(u.id)!.engagedTurns > 0));
  }

  private moveUnits() {
    const moves: [Unit, string][] = [];
    for (const u of this.state.units) {
      if (!this.alive(u)) continue;
      const um = this.umeta.get(u.id)!;
      const halt = () => { u.moving = undefined; um.hop = undefined; um.progress = 0; um.carry = 0; };
      if (u.status === 'routed') { halt(); const fb = this.fallbackNode(u); if (fb && this.at(u.nodeId, other(u.side)).length) moves.push([u, fb]); continue; }
      if (!um.destination || um.destination === u.nodeId) { halt(); continue; }
      if (this.contested(u.nodeId) && u.order?.type !== 'fall_back') { halt(); continue; } // locked in the fight
      const p = this.pathTo(u.nodeId, um.destination, u.side);
      if (p.length < 2) { halt(); continue; }
      const hop = p[1];
      if (um.hop !== hop) { um.hop = hop; um.progress = um.carry; }
      um.carry = 0;
      // Ground decides how far the column gets in half an hour; it may still be on the road at the end of it.
      const { cost, ground } = this.marchCost(u, u.nodeId, hop);
      um.progress += 1 / cost;
      u.fatigue = Math.min(100, u.fatigue + 6);
      if (um.progress >= 1) { um.carry = Math.min(0.5, um.progress - 1); moves.push([u, hop]); }
      else { u.moving = { to: hop, progress: um.progress, ground }; u.status = 'marching'; }
    }
    for (const [u, to] of moves) {
      u.nodeId = to; u.moving = undefined;
      const um = this.umeta.get(u.id)!; um.movedInto = to; um.hop = undefined; um.progress = 0;
      if (u.status !== 'routed') u.status = 'marching';
      if (um.destination === to) um.destination = undefined;
      if (u.agentId) this.cmd(u.agentId).nodeId = to;
    }
    for (const n of NODES) {
      if (this.contested(n.id)) continue;
      const u = this.at(n.id)[0];
      if (u) {
        if (this.control[n.id] !== u.side && this.control[n.id] !== 'empty') this.event('capture', `${this.nodeName(n.id)} is taken by ${u.side === 'union' ? 'Union' : 'Confederate'} troops.`, n.id, u.side);
        this.control[n.id] = u.side;
      }
    }
  }

  /** Every brigade in contact decides for itself how to meet it. */
  private async reactions(t: number) {
    await this.answerCalls(t);
    const jobs: Promise<void>[] = [];
    for (const n of NODES) {
      if (!this.contested(n.id)) continue;
      const defender = this.defenderAt(n.id);
      for (const u of this.at(n.id)) {
        u.status = 'engaged';
        const um = this.umeta.get(u.id)!; const foes = this.at(n.id, other(u.side)); const friends = this.at(n.id, u.side);
        const ratio = friends.reduce((a, b) => a + b.strength, 0) / Math.max(1, foes.reduce((a, b) => a + b.strength, 0));
        const attacking = defender !== u.side;
        const chamberlain = u.agentId === 'chamberlain';
        const low = u.ammo <= 20; const steady = u.morale > (attacking ? 34 : 40); const fb = this.fallbackNode(u);
        const refused = um.stance === 'refuse';
        let options: QOption[];
        if (chamberlain) {
          options = [
            this.opt('stand', 'Holds the line by fire', 'Hold the line and keep up the fire.', u.ammo <= 5 ? 0.3 : low ? 2 : 4),
            this.opt('refuse', refused ? 'Holds with the left bent back' : 'Bends back the left wing', refused ? 'Stay as formed, the left wing bent back, and try to hold without ammunition.' : 'Bend the left wing back at a right angle to face the column working around the flank.', u.ammo <= 5 ? 0.8 : refused ? 3 : 4.5),
            this.opt('charge', 'Orders the bayonet', 'Fix bayonets and charge down the slope before the enemy strikes again.', u.ammo <= 5 ? 6 : 0.4),
            this.opt('fall_back', 'Withdraws from the spur', 'Give up the spur and fall back toward the brigade.', low ? 1.2 : 0.2),
          ];
        } else if (attacking) {
          options = [
            this.opt('press', 'Presses the attack', 'Push the attack home.', steady ? 4.5 : 1.4),
            this.opt('hold', 'Holds and trades fire', 'Hold the ground gained and keep up the fire.', steady ? 2 : 3),
            ...(fb ? [this.opt('fall_back', 'Falls back', 'Break off the attack and fall back.', steady ? 0.3 : 3.5)] : []),
          ];
        } else {
          options = [
            this.opt('stand', 'Stands fast', 'Hold the position and keep up the fire.', steady ? 5 : 2),
            this.opt('charge', 'Countercharges', 'Counterattack with the bayonet.', low && steady ? 2.5 : 0.5),
            ...(fb ? [this.opt('fall_back', 'Falls back', 'Give up the position and fall back in order.', steady ? 0.3 : 3.5)] : []),
          ];
        }
        const cdr = chamberlain ? this.cmd('chamberlain') : null;
        const q: Question = {
          id: 'react',
          instructions: `${u.leader}'s ${u.name} is ${attacking ? 'attacking' : 'defending'} ${this.nodeName(n.id)}. What does ${chamberlain ? 'Colonel Chamberlain' : 'its commander'} do this half hour?`,
          options,
        };
        const state = {
          battle: `${BATTLE.name}, ${BATTLE.date}`,
          you: cdr ? { name: `${cdr.rank} ${cdr.name}`, command: cdr.role, background: this.cmeta.get('chamberlain')!.seed.brief, ...(cdr.traits.length ? { character: cdr.traits.map((x) => x.text) } : {}) } : { name: u.leader, command: u.name },
          situation: {
            time: this.clockLabel(t), ground: `${this.nodeName(n.id)} (${this.node(n.id).terrain})`, role: attacking ? 'attacking' : 'defending',
            your_men: `${u.strength} of ${u.strength0} still in the ranks, ${moraleWord(u.morale)}, ${fatigueWord(u.fatigue)}, ${ammoWord(u.ammo)}`,
            half_hours_under_fire: um.engagedTurns, odds: ratio >= 1.25 ? 'you outnumber the enemy here' : ratio <= 0.8 ? 'the enemy outnumbers you here' : 'the numbers are about even',
            enemy: foes.map((f) => `${f.name} (about ${Math.round(f.strength / 100) * 100})`), beside_you: friends.filter((f) => f.id !== u.id).map((f) => f.name),
            orders: u.order?.label ?? 'hold',
            ...(chamberlain && refused ? { your_line: 'The left wing is already bent back at a right angle; the line is stretched to a single rank.' } : {}),
            ...(u.ammo <= 5 && !attacking ? { crisis: 'The last cartridges are fired. The men are searching the boxes of the fallen. The enemy below is forming to come on again, and you cannot answer his fire.' } : {}),
          },
        };
        const first = chamberlain && u.ammo <= 5 && !this.cmeta.get('chamberlain')!.flags.scored;
        if (first) this.cmeta.get('chamberlain')!.flags.scored = true;
        jobs.push(this.decide({
          agentId: cdr ? cdr.id : u.id, agentName: cdr ? cdr.name : u.leader, side: u.side, tier: 'brigade', commanderId: cdr?.id,
          traits: cdr?.traits, dispatch: !!cdr, state,
          questions: [{ q, kind: 'reaction', unitId: cdr ? undefined : u.id, unitName: cdr ? undefined : u.name, historical: first ? 'charge' : undefined, checkpoint: first ? 'chamberlain_charge' : undefined }],
        }).then((r) => {
          um.stance = r.react as UnitMeta['stance'];
          if (cdr) cdr.intent = options.find((o) => o.id === r.react)?.label;
          if (r.react === 'charge') this.event('charge', chamberlain ? 'The 20th Maine fixes bayonets and sweeps down the slope.' : `${u.name} goes in with the bayonet at ${this.nodeName(n.id)}.`, n.id, u.side);
        }));
      }
    }
    await Promise.all(jobs);
  }

  private defenderAt(nodeId: string): Side | null {
    const h = this.control[nodeId];
    if (h === 'union' || h === 'confederate') return h;
    const moved = (s: Side) => this.at(nodeId, s).every((u) => this.umeta.get(u.id)!.movedInto === nodeId);
    if (moved('union') && !moved('confederate')) return 'confederate';
    if (moved('confederate') && !moved('union')) return 'union';
    return null;
  }

  private resolveCombat(t: number) {
    for (const n of NODES) {
      if (!this.contested(n.id)) continue;
      const defender = this.defenderAt(n.id);
      const sides: Side[] = ['union', 'confederate'];
      const power: Record<Side, number> = { union: 0, confederate: 0 };
      const shock: Record<Side, number> = { union: 0, confederate: 0 };
      const mult: Record<UnitMeta['stance'], [number, number]> = { press: [1.15, 1.1], hold: [0.9, 0.9], stand: [1, 1], refuse: [0.95, 0.85], charge: [1.5, 1.2], fall_back: [0.4, 0.6] };
      for (const u of this.at(n.id)) {
        const um = this.umeta.get(u.id)!; const [out] = mult[um.stance] ?? [1, 1];
        const ammo = um.stance === 'charge' ? 1 : u.ammo > 15 ? 1 : Math.max(0.45, 0.45 + u.ammo / 27);
        let p = u.strength * (0.45 + 0.55 * (u.morale / 100)) * (1 - u.fatigue / 260) * ammo * out;
        power[u.side] += p;
        if (um.stance === 'charge') shock[other(u.side)] += u.agentId === 'chamberlain' ? 26 : 12;
      }
      const lost: Record<Side, number> = { union: 0, confederate: 0 };
      for (const s of sides) {
        const foe = other(s); const mine = this.at(n.id, s); const total = mine.reduce((a, b) => a + b.strength, 0);
        let inflicted = 0.105 * power[foe] * (0.8 + 0.4 * this.rng());
        if (defender === s) inflicted /= n.defense;
        for (const u of mine) {
          const um = this.umeta.get(u.id)!; const [, taken] = mult[um.stance] ?? [1, 1];
          const loss = Math.min(Math.round(u.strength * 0.4), Math.round((inflicted * (u.strength / total)) * taken));
          const frac = loss / Math.max(1, u.strength);
          u.strength -= loss; lost[s] += loss;
          const outnumbered = power[s] * (defender === s ? n.defense : 1) < power[foe] * (defender === foe ? n.defense : 1) * 0.75;
          u.morale = Math.max(0, Math.min(95, u.morale - frac * 175 - (outnumbered ? 4 : -2) - shock[s] + (um.stance === 'charge' ? 6 : 0)));
          u.ammo = Math.max(0, u.ammo - (um.stance === 'charge' ? 4 : um.seed.ammo ? 40 : 20)); // the flank regiment burns through its sixty rounds fastest
          u.fatigue = Math.min(100, u.fatigue + 9);
          um.engagedTurns++;
        }
        this.state.casualties[s] += lost[s];
      }
      const names = (s: Side) => this.at(n.id, s).map((u) => u.short).join(', ');
      this.event('clash', `${this.nodeName(n.id)}: ${names('confederate')} against ${names('union')}. Losses about ${lost.confederate} Confederate, ${lost.union} Union.`, n.id);
    }
  }

  private afterCombat(t: number) {
    for (const u of this.state.units) {
      if (!this.alive(u)) continue;
      const um = this.umeta.get(u.id)!;
      const inFight = this.at(u.nodeId, other(u.side)).length > 0;
      if (u.status === 'routed') {
        if (um.routedUntil !== undefined && t >= um.routedUntil) { u.status = 'spent'; u.morale = Math.max(u.morale, 32); }
        continue;
      }
      if (inFight && (u.morale < 20 || u.strength < u.strength0 * 0.3)) {
        u.status = 'routed'; um.routedUntil = t + 2; um.destination = undefined; um.stance = 'hold';
        const taken = Math.round(u.strength * 0.12); u.strength -= taken; this.state.casualties[u.side] += taken;
        this.event('rout', `${u.name} breaks and streams back from ${this.nodeName(u.nodeId)}.`, u.nodeId, u.side);
        const fb = this.fallbackNode(u); if (fb) { u.prevNodeId = u.nodeId; u.nodeId = fb; if (u.agentId) this.cmd(u.agentId).nodeId = fb; }
        continue;
      }
      if (inFight && um.stance === 'fall_back') {
        const fb = this.fallbackNode(u);
        if (fb) { u.nodeId = fb; um.destination = undefined; this.event('note', `${u.name} falls back to ${this.nodeName(fb)}.`, fb, u.side); }
        u.status = u.morale < 40 ? 'shaken' : 'ready'; um.stance = 'hold';
        continue;
      }
      if (inFight) { u.status = 'engaged'; continue; }
      // out of contact: rest
      u.morale = Math.min(u.status === 'spent' ? 45 : 88, u.morale + 3);
      u.fatigue = Math.max(0, u.fatigue - (um.movedInto ? 0 : 5));
      if (u.status !== 'spent') u.status = u.morale < 40 ? 'shaken' : um.destination ? 'marching' : 'ready';
      um.stance = 'hold';
    }
    for (const n of NODES) {
      if (this.contested(n.id)) continue;
      const u = this.at(n.id)[0];
      if (u && this.control[n.id] !== u.side) {
        if (this.control[n.id] !== 'empty' || n.objective) this.event('capture', `${this.nodeName(n.id)} is in ${u.side === 'union' ? 'Union' : 'Confederate'} hands.`, n.id, u.side);
        this.control[n.id] = u.side;
      }
    }
    // The hazards of command.
    const hood = this.cmd('hood');
    if (hood.status === 'active' && !hood.controlledBy && this.state.units.some((u) => u.commanderId === 'hood' && u.status === 'engaged') && this.rng() < 0.55) {
      hood.status = 'wounded'; hood.intent = 'Carried from the field';
      this.event('wounded', 'Hood is struck down by a shell burst. Law succeeds him; the brigades go on with the orders they have.', hood.nodeId, 'confederate');
    }
    const sickles = this.cmd('sickles');
    if (sickles.status === 'active' && !sickles.controlledBy && t >= 5 && [sickles.nodeId, ...(this.adj.get(sickles.nodeId) ?? [])].some((n) => this.at(n, 'confederate').length) && this.rng() < 0.4) {
      sickles.status = 'wounded'; sickles.intent = 'Carried from the field';
      this.event('wounded', "A cannonball shatters Sickles's leg. Birney takes the corps.", sickles.nodeId, 'union');
    }
  }

  private refreshObjectives() {
    this.state.objectives = NODES.filter((n) => n.objective).map((n) => ({
      nodeId: n.id, name: n.name, historical: n.historical ?? 'empty',
      holder: this.contested(n.id) ? 'contested' : this.control[n.id],
    }));
  }

  /** Has the field been decided? */
  private assess(): { decided: boolean; winner?: Side | 'none'; text: string } {
    const s = this.state;
    const objectives = s.objectives;
    const holdsAll = (side: Side) => objectives.length > 0 && objectives.every((o) => o.holder === side);
    const name = (side: Side) => (side === 'union' ? 'The Union army' : 'The Confederate attack');
    if (holdsAll('union')) return { decided: true, winner: 'union', text: 'The Union holds every key position. The Confederate attack has failed.' };
    if (holdsAll('confederate')) return { decided: true, winner: 'confederate', text: 'The Confederates hold every key position. The Union left has been driven from the field.' };
    for (const side of ['union', 'confederate'] as Side[]) {
      const all = s.units.filter((u) => u.side === side);
      const start = all.reduce((a, u) => a + u.strength0, 0);
      // Brigades resting after a fight still count; only men in flight, or lost, do not.
      const fit = all.filter((u) => u.strength > 0 && u.status !== 'routed').reduce((a, u) => a + u.strength, 0);
      if (start > 0 && fit < start * 0.25) {
        const other: Side = side === 'union' ? 'confederate' : 'union';
        return { decided: true, winner: other, text: `${name(side)} can no longer fight: fewer than one man in four is still in the ranks.` };
      }
    }
    if (s.extended && this.quiet >= 2) return { decided: true, winner: 'none', text: 'Both armies stand where they are and neither attacks again. The fighting is over; the field is divided.' };
    return { decided: false, text: 'Neither side has carried the field.' };
  }

  private endOfDay() {
    const s = this.state;
    const outcome = this.assess();
    const cap = BATTLE.maxTurns + EXTRA_TURNS;
    s.outcome = outcome;
    s.canFightOn = !outcome.decided && s.maxTurns < cap;
    const losses = `Losses: about ${s.casualties.confederate} Confederate, ${s.casualties.union} Union.`;
    if (!s.extended) this.event('note', `Dusk. The firing dies away. ${outcome.text} ${losses}`);
    else this.event('note', `${this.clockLabel(s.turn)}. ${outcome.decided ? outcome.text : 'Exhaustion ends it before either side breaks. ' + outcome.text} ${losses}`);
  }

  /** History ends at dusk; if the field is not decided, the player may fight on until it is. */
  fightOn(): boolean {
    const s = this.state;
    if (s.phase !== 'ended' || !s.canFightOn) return false;
    s.extended = true;
    s.maxTurns = BATTLE.maxTurns + EXTRA_TURNS;
    s.phase = 'ready';
    s.outcome = undefined;
    s.canFightOn = false;
    s.council = undefined;
    s.report = { status: 'idle' };
    this.quiet = 0;
    this.event('note', 'History ends at dusk, but the battle is not decided. The fight goes on into the night.');
    this.emit();
    return true;
  }

  private save() {
    try {
      const dir = path.join(ROOT, 'data', 'runs');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${this.state.runId}.json`), JSON.stringify(this.runLog(), null, 1));
    } catch (e) { console.warn('[save]', (e as Error).message); }
  }

  /** The record the after-action report is written from. */
  runLog() {
    const s = this.state;
    return {
      battle: s.battle, date: s.date, mode: s.mode, model: s.model, seed: s.seed, personas: s.personas, ended_at: s.clock,
      objectives: s.objectives, casualties: s.casualties, fidelity: s.fidelity, ledger: s.ledger,
      commanders: s.commanders.map((c) => ({ name: c.name, role: c.role, side: c.side, status: c.status, traits: c.traits.map((t) => t.label) })),
      hardest_hit_units: [...s.units].filter((u) => u.strength < u.strength0 * 0.75).sort((a, b) => a.strength / a.strength0 - b.strength / b.strength0).slice(0, 8).map((u) => `${u.name} (${u.side}): ${u.strength} of ${u.strength0} left, ${u.status}, at ${this.nodeName(u.nodeId)}`),
      // Command decisions only: routine brigade orders and reactions would bury them.
      decisions: this.allDecisions.filter((d) => d.by === 'human' || d.historical || ['objective', 'compliance', 'protest_ruling'].includes(d.kind) || (d.kind === 'reinforcement' && !d.unitId)).map((d) => ({
        time: d.clock, who: d.agentName, question: d.question, chose: d.options.find((o) => o.id === d.chosen)?.label, by: d.by,
        probability: Number((d.options.find((o) => o.id === d.chosen)?.p ?? 0).toFixed(3)),
        historical: d.historical ? d.options.find((o) => o.id === d.historical)?.label : undefined, matches_history: d.matchesHistory, decider_would_have: d.wouldHave,
      })),
      events: s.events.filter((e) => e.kind !== 'clash').map((e) => `${e.clock} ${e.text}`),
    };
  }

  // ------------------------------------------------------------ commands

  setAuto(on: boolean, delayMs?: number) {
    if (delayMs) this.autoDelay = Math.max(600, Math.min(15000, delayMs));
    this.stopAuto();
    this.state.auto = on && this.state.phase !== 'ended';
    if (this.state.auto) this.autoLoop();
    this.emit();
  }
  private stopAuto() { if (this.autoTimer) clearTimeout(this.autoTimer); this.autoTimer = null; if (this.state) this.state.auto = false; }
  private autoLoop() {
    const tick = async () => {
      if (!this.state.auto) return;
      await this.step();
      if (this.state.auto && this.state.phase !== 'ended') this.autoTimer = setTimeout(tick, this.autoDelay);
    };
    this.autoTimer = setTimeout(tick, 300);
  }

  claim(commanderId: string, clientId: string) {
    const c = this.cmd(commanderId); if (!c || c.status !== 'active') return false;
    if (c.controlledBy && c.controlledBy !== clientId) return false;
    c.controlledBy = clientId; this.event('note', `A player takes ${c.name}'s place.`, c.nodeId, c.side); this.emit(); return true;
  }
  release_(commanderId: string, clientId?: string) {
    const c = this.cmd(commanderId); if (!c || (clientId && c.controlledBy !== clientId)) return;
    c.controlledBy = null;
    for (const p of this.state.pending.filter((p) => p.commanderId === commanderId)) this.resolvers.get(p.id)?.(this.suggestions.get(p.id) ?? '');
    this.emit();
  }
  dropClient(clientId: string) { for (const c of this.state.commanders) if (c.controlledBy === clientId) this.release_(c.id); }

  choose(pendingId: string, optionId: string) {
    const r = this.resolvers.get(pendingId); if (!r) return false;
    r(optionId); return true;
  }

  /** A written order in plain English: Drex maps it onto the legal options. */
  async typed(pendingId: string, text: string): Promise<TypedResult> {
    const p = this.state.pending.find((x) => x.id === pendingId); const q0 = this.pendingQuestions.get(pendingId);
    if (!p || !q0) return { ok: false, options: [], error: 'That decision is no longer waiting.' };
    const c = this.cmd(p.commanderId);
    const lower = text.toLowerCase();
    const overlap = (o: QOption) => {
      const hay = `${o.id} ${o.label} ${o.description}`.toLowerCase();
      let score = 1 + lower.split(/[^a-z']+/).filter((w) => w.length > 3 && hay.includes(w)).length * 2;
      if (/(as ordered|obey|comply|as instructed|stay|remain)/.test(lower) && /^(obey|hold|stand|stay)/.test(o.id)) score += 6;
      return score;
    };
    const q: Question = {
      id: 'typed',
      instructions: `${c.rank} ${c.name} was asked: "${p.question}" He wrote this order in his own words. Which of the available courses does the written order mean?`,
      options: [...q0.options.map((o) => ({ ...o, mock: overlap(o) })), this.opt('unclear', 'None of these', 'The written order does not correspond to any of the available courses.', 0.8)],
    };
    try {
      const res = await this.decider.ask({ state: { written_order: text, question_before_him: p.question }, questions: [q] });
      this.updateLedger(res.latencyMs, res.inputTokens, res.costUsd, 1);
      const a = res.answers.typed;
      const d: Decision = {
        id: `d${++this.seq}`, turn: this.state.turn, clock: this.state.clock, agentId: c.id, agentName: c.name, side: c.side, tier: c.tier,
        kind: 'typed_order', question: `Reading the written order: "${text}"`, options: a.options, chosen: a.chosen, by: res.by, model: res.model,
        latencyMs: res.latencyMs, inputTokens: res.inputTokens, costUsd: res.costUsd, explainable: false, dispatch: `"${text}"`,
      };
      this.allDecisions.push(d); this.state.decisions.push(d);
      if (a.chosen === 'unclear') { this.emit(); return { ok: false, options: a.options, error: 'Drex could not match that to a legal order. Try again or pick one.' }; }
      this.choose(pendingId, a.chosen);
      return { ok: true, options: a.options, chosen: a.chosen };
    } catch (e) { return { ok: false, options: [], error: (e as Error).message }; }
  }

  /** Why did he choose that? Ask again with each trait removed and compare. */
  async explain(decisionId: string): Promise<ExplainResult | null> {
    const log = this.askLog.get(decisionId); const d = this.allDecisions.find((x) => x.id === decisionId);
    if (!log || !d) return null;
    const started = Date.now();
    const pWith = d.options.find((o) => o.id === d.chosen)?.p ?? 0;
    const texts: string[] = log.state?.you?.character ?? [];
    const traits = await Promise.all(log.traits.map(async (trait, i) => {
      const state = JSON.parse(JSON.stringify(log.state));
      state.you.character = texts.filter((x) => x !== trait.text);
      const hashFlat = 0.15 + ((trait.id.length * 37 + i * 53 + decisionId.length * 11) % 50) / 100;
      const res = await this.decider.ask({ state, questions: [log.question], mockFlatten: hashFlat });
      this.updateLedger(res.latencyMs, res.inputTokens, res.costUsd, 1);
      const pWithout = res.answers[log.question.id].options.find((o) => o.id === d.chosen)?.p ?? 0;
      return { traitId: trait.id, label: trait.label, citation: trait.citation, pWithout, delta: pWith - pWithout };
    }));
    traits.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    this.emit();
    return { decisionId, chosen: d.chosen, chosenLabel: d.options.find((o) => o.id === d.chosen)?.label ?? d.chosen, pWith, traits, latencyMs: Date.now() - started };
  }

  /** Meade polls his corps commanders, as he did that night. */
  async council() {
    const meade = this.cmd('meade');
    const summary = {
      battle: `${BATTLE.name}, ${BATTLE.date}`, occasion: 'Council of war at army headquarters after dark. Each general is asked whether the army should stay or go.',
      the_day: { ground: this.state.objectives.map((o) => `${o.name}: ${o.holder === 'contested' ? 'disputed' : o.holder === 'union' ? 'ours' : o.holder === 'confederate' ? "the enemy's" : 'unoccupied'}`), union_losses: this.state.casualties.union, enemy_losses_estimated: this.state.casualties.confederate },
    };
    const heldLeft = this.state.objectives.filter((o) => o.holder === 'union').length;
    const questions = COUNCIL.map((g, i) => ({
      kind: 'council' as DecisionKind,
      q: {
        id: `v${i}`, instructions: `General ${g.name}, ${g.role}. ${g.note} How does he vote?`,
        options: [
          this.opt('stay', 'Stay and await attack', 'Remain in the present position and receive the enemy\'s attack.', heldLeft >= 2 ? 6 : 2.5),
          this.opt('attack', 'Stay and attack', 'Remain and take the offensive tomorrow.', g.name.includes('Hancock') || g.name.includes('Howard') ? 1.6 : 0.6),
          this.opt('retire', 'Retire nearer the base of supplies', 'Withdraw the army to a position nearer its supplies.', heldLeft >= 2 ? 0.5 : 3),
        ],
      },
    }));
    const r = await this.decide({ agentId: 'council', agentName: 'Council of war', side: 'union', tier: 'corps', state: summary, questions });
    const votes = COUNCIL.map((g, i) => {
      const d = [...this.allDecisions].reverse().find((x) => x.agentId === 'council' && x.question.includes(g.name))!;
      d.agentName = g.name; d.historical = 'stay'; d.matchesHistory = r[`v${i}`] === 'stay';
      return { name: g.name, role: g.role, options: d.options, chosen: r[`v${i}`], historical: 'stay' };
    });
    const tally = (id: string) => votes.filter((v) => v.chosen === id).length;
    const stay = tally('stay') + tally('attack');
    this.state.council = { votes, result: stay > tally('retire') ? `${stay} of ${votes.length} to stay. "Such then is the decision."` : `${tally('retire')} of ${votes.length} to retire. The army will fall back in the night.` };
    this.event('note', `Council of war: ${this.state.council.result}`, meade.nodeId, 'union');
    this.emit();
    return this.state.council;
  }
}
