// Clio: the contract between server/ and web/.
// The server owns the game state and broadcasts the whole GameState over WebSocket
// (/ws) after every change. The web client renders it and sends commands over REST.
//
// REST (all JSON, all under /api):
//   GET  /api/state                               -> GameState
//   POST /api/reset    { seed?: number, personas?: boolean }  -> GameState (new battle; personas=false strips traits)
//   POST /api/step     {}                         -> advance one turn (no-op while a turn is running)
//   POST /api/auto     { on: boolean, delayMs?: number }      -> autoplay on/off
//   POST /api/claim    { commanderId, clientId }  -> a human takes over a commander
//   POST /api/release  { commanderId, clientId }  -> hand the commander back to Drex
//   POST /api/choose   { pendingId, optionId, clientId }      -> answer a PendingChoice by clicking
//   POST /api/typed    { pendingId, text, clientId }          -> answer a PendingChoice in plain English;
//                                                    Drex maps the text to one of the legal options -> TypedResult
//   POST /api/explain  { decisionId }             -> ExplainResult (trait ablation)
//   POST /api/report   {}                         -> starts the after-action report (state.report updates)
//   POST /api/council  {}                         -> runs the council of war (state.council updates)
//
// WebSocket /ws: server sends ServerMessage. First message is { type: 'hello', clientId }.

export type Side = 'union' | 'confederate';
export type Holder = Side | 'contested' | 'empty';
export type Terrain = 'open' | 'farm' | 'woods' | 'rocks' | 'ridge' | 'hill';

/** Map coordinates are in a 1600 x 1000 space, north up. */
export interface MapNode {
  id: string;
  name: string;
  /** Short label for tight spaces. */
  short: string;
  x: number;
  y: number;
  terrain: Terrain;
  /** Defender's multiplier from the ground, 1.0 = none. */
  defense: number;
  /** Key ground tracked for the end-state comparison. */
  objective?: boolean;
  /** Who held it at nightfall on July 2, 1863. */
  historical?: Holder;
  /** Headquarters marker, if a commander's HQ sits here. */
  hq?: Side;
  note?: string;
}

export interface MapEdge {
  a: string;
  b: string;
  /** Named road, if this edge follows one (drawn heavier). */
  road?: string;
  /** Optional intermediate points so roads can bend. */
  via?: [number, number][];
  /** Name of a stream this route has to ford. */
  ford?: string;
}

export type UnitStatus = 'reserve' | 'ready' | 'marching' | 'engaged' | 'shaken' | 'routed' | 'spent';
export type OrderType = 'hold' | 'march' | 'attack' | 'fall_back' | 'charge';

export interface UnitOrder {
  type: OrderType;
  /** Target node id for march / attack / fall_back / charge. */
  target?: string;
  label: string;
}

export interface Unit {
  id: string;
  /** e.g. "Law's Brigade". */
  name: string;
  short: string;
  side: Side;
  /** Who leads it in the field, e.g. "Brig. Gen. Evander M. Law". */
  leader: string;
  /** The commander whose orders it takes. */
  commanderId: string;
  /** Set when a persona commander leads this unit personally (Chamberlain and the 20th Maine). */
  agentId?: string;
  nodeId: string;
  /** Node it was in at the start of the turn; differs from nodeId when it just marched. */
  prevNodeId: string;
  strength: number;
  strength0: number;
  /** 0 to 100. */
  morale: number;
  /** 0 to 100, higher is more tired. */
  fatigue: number;
  /** 0 to 100. */
  ammo: number;
  status: UnitStatus;
  order?: UnitOrder;
  /** True until the unit has been released from reserve / arrived on the field. */
  inReserve?: boolean;
  /**
   * Set while the unit is on the road between two places. It still counts as being at
   * `nodeId` until it arrives. `progress` is 0 to 1 along the route; `ground` says what the
   * going is like, e.g. "across country, over boulders, fording Plum Run".
   */
  moving?: { to: string; progress: number; ground: string };
}

export type Tier = 'army' | 'corps' | 'brigade';

export interface Citation {
  /** Human title of the source document. */
  doc: string;
  url: string;
  page?: string;
  quote?: string;
  /** NDI field status. */
  status?: 'found' | 'ambiguous' | 'not_found';
}

export interface Trait {
  id: string;
  /** Two or three words, e.g. "Defers to Lee". */
  label: string;
  /** One sentence, in the third person. */
  text: string;
  citation?: Citation;
}

export type Compliance = 'obey' | 'delay' | 'protest' | 'deviate';

export interface StandingOrder {
  fromId: string;
  fromName: string;
  text: string;
  issuedTurn: number;
  receivedTurn: number;
}

export interface Commander {
  id: string;
  name: string;
  /** e.g. "General", "Maj. Gen.", "Col.". */
  rank: string;
  /** e.g. "Army of Northern Virginia", "III Corps", "20th Maine". */
  role: string;
  side: Side;
  tier: Tier;
  superiorId?: string;
  /** Where the commander is on the map. */
  nodeId: string;
  /** URL path of the portrait; may 404 until Firefly assets exist, so render a fallback. */
  portrait: string;
  traits: Trait[];
  /** 'ndi' when the traits came from NDI Extract, 'authored' for the built-in fallback, 'none' when stripped. */
  personaSource: 'ndi' | 'authored' | 'none';
  standingOrder?: StandingOrder;
  /** Latest answer to the standing order. */
  compliance?: Compliance;
  /** clientId of the human who has taken over, if any. */
  controlledBy?: string | null;
  status: 'active' | 'wounded';
  /** One line of what the commander is doing right now. */
  intent?: string;
}

export interface Courier {
  id: string;
  kind: 'order' | 'protest' | 'request' | 'reply';
  fromId: string;
  toId: string;
  /** Node ids from origin to destination, inclusive. */
  path: string[];
  departTurn: number;
  arriveTurn: number;
  text: string;
  delivered: boolean;
}

export interface DecisionOption {
  id: string;
  label: string;
  description?: string;
  /** Probability from the decider, 0 to 1. */
  p: number;
}

export type DecisionKind =
  | 'objective'
  | 'compliance'
  | 'order'
  | 'reaction'
  | 'protest_ruling'
  | 'reinforcement'
  | 'council'
  | 'typed_order';

export interface Decision {
  id: string;
  turn: number;
  clock: string;
  /** Commander id, or unit id for brigade reactions. */
  agentId: string;
  agentName: string;
  side: Side;
  tier: Tier;
  kind: DecisionKind;
  /** The question as put to the decider. */
  question: string;
  options: DecisionOption[];
  /** Option id that was acted on. */
  chosen: string;
  by: 'drex' | 'mock' | 'human';
  model?: string;
  latencyMs: number;
  inputTokens: number;
  costUsd: number;
  /** Option id the real commander took, when documented. */
  historical?: string;
  matchesHistory?: boolean;
  /** One in-character line. */
  dispatch?: string;
  unitId?: string;
  /** When a human overrode the decider: what the decider would have done. */
  wouldHave?: string;
  /** True if /api/explain can be run on this decision. */
  explainable: boolean;
}

/** A decision waiting for the human who controls that commander. */
export interface PendingChoice {
  id: string;
  commanderId: string;
  kind: DecisionKind;
  question: string;
  options: DecisionOption[];
  unitId?: string;
  unitName?: string;
}

export interface Ledger {
  decisions: number;
  medianMs: number;
  inputTokens: number;
  costUsd: number;
  /** Estimate for the same decisions on a frontier LLM. */
  frontierCostUsd: number;
  frontierSeconds: number;
  /** Filled once the measured comparison has been run. */
  measured?: { model: string; decisions: number; medianMs: number; costUsd: number };
}

export interface ObjectiveState {
  nodeId: string;
  name: string;
  holder: Holder;
  historical: Holder;
}

export interface BattleEvent {
  id: string;
  turn: number;
  clock: string;
  kind: 'clash' | 'rout' | 'charge' | 'arrival' | 'capture' | 'courier' | 'wounded' | 'note';
  nodeId?: string;
  side?: Side;
  text: string;
}

export interface Checkpoint {
  id: string;
  label: string;
  /** What the record says happened. */
  historicalLabel: string;
  actualLabel?: string;
  matched?: boolean;
  turn?: number;
  decisionId?: string;
}

export interface Fidelity {
  checkpoints: Checkpoint[];
  matched: number;
  decided: number;
  /** Results of the offline comparison runs, when available. */
  withPersona?: { matched: number; total: number };
  withoutPersona?: { matched: number; total: number };
}

export interface CouncilVote {
  name: string;
  role: string;
  options: DecisionOption[];
  chosen: string;
  historical?: string;
}

export interface Report {
  status: 'idle' | 'writing' | 'done' | 'error';
  markdown?: string;
  by?: 'intern' | 'template';
  note?: string;
}

export interface GameState {
  runId: string;
  battle: string;
  date: string;
  mode: 'mock' | 'drex';
  model?: string;
  seed: number;
  personas: boolean;
  turn: number;
  maxTurns: number;
  /** 24-hour "HH:MM" battle time at the start of the current turn. */
  clock: string;
  phase: 'ready' | 'deciding' | 'resolving' | 'ended';
  auto: boolean;
  nodes: MapNode[];
  edges: MapEdge[];
  units: Unit[];
  commanders: Commander[];
  couriers: Courier[];
  /** Newest last; capped. */
  decisions: Decision[];
  /** Newest last; capped. */
  events: BattleEvent[];
  pending: PendingChoice[];
  ledger: Ledger;
  objectives: ObjectiveState[];
  fidelity: Fidelity;
  casualties: { union: number; confederate: number };
  council?: { votes: CouncilVote[]; result: string };
  report: Report;
  clients: number;
  /** True once the player chose to fight on past the end of the historical day. */
  extended?: boolean;
  /** Set when the battle ends: whether the field was decided, and how. */
  outcome?: { decided: boolean; winner?: Side | 'none'; text: string };
  /** At an undecided end: the battle may be fought on past dusk. */
  canFightOn?: boolean;
}

export interface TraitEffect {
  traitId: string;
  label: string;
  citation?: Citation;
  /** Probability of the chosen option with this trait removed. */
  pWithout: number;
  /** pWith - pWithout: positive means the trait pushed toward the choice. */
  delta: number;
}

export interface ExplainResult {
  decisionId: string;
  chosen: string;
  chosenLabel: string;
  pWith: number;
  traits: TraitEffect[];
  latencyMs: number;
}

export interface TypedResult {
  ok: boolean;
  /** Probability Drex gave each legal option for the typed text. */
  options: DecisionOption[];
  chosen?: string;
  error?: string;
}

export type ServerMessage = { type: 'hello'; clientId: string } | { type: 'state'; state: GameState };
