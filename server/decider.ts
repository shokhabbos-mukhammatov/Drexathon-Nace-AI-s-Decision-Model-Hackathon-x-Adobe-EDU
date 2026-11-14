// The decider: every agent decision in Clio goes through ask().
// DrexDecider calls POST /v1/systemone on the Nace console; MockDecider is an offline stand-in
// so the engine and UI run without a key. Both return a probability for every option.
import type { DecisionOption } from '../shared/types.ts';

export interface QOption {
  id: string;
  label: string;
  /** What Drex reads as the option's meaning. */
  description: string;
  /** Mock decider only: relative weight. Never sent to Drex. */
  mock?: number;
}

export interface Question {
  id: string;
  instructions: string;
  options: QOption[];
}

export interface AskRequest {
  /** Any JSON: persona, standing orders, situation. */
  state: unknown;
  questions: Question[];
  /** Mock decider only: 0..1, how much to flatten the weights (used for trait ablation and no-persona runs). */
  mockFlatten?: number;
}

export interface Answer {
  options: DecisionOption[];
  chosen: string;
}

export interface AskResult {
  answers: Record<string, Answer>;
  latencyMs: number;
  inputTokens: number;
  costUsd: number;
  model: string;
  by: 'drex' | 'mock';
}

export interface Decider {
  readonly mode: 'drex' | 'mock';
  readonly model: string;
  ask(req: AskRequest): Promise<AskResult>;
}

const USD_PER_INPUT_TOKEN = 30e-9; // $0.03 per million input tokens (console pricing page)

function argmax(options: DecisionOption[]): string {
  let best = options[0];
  for (const o of options) if (o.p > best.p) best = o;
  return best.id;
}

// ---------------------------------------------------------------- mock

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

export class MockDecider implements Decider {
  readonly mode = 'mock' as const;
  readonly model = 'mock-decider';

  async ask(req: AskRequest): Promise<AskResult> {
    const started = Date.now();
    const text = JSON.stringify(req.state);
    const answers: Record<string, Answer> = {};
    for (const q of req.questions) {
      const flatten = req.mockFlatten ?? 0;
      const raw = q.options.map((o) => {
        const w = Math.max(0.02, o.mock ?? 1);
        const jitter = 0.9 + 0.2 * hash(q.id + o.id + text.length);
        return Math.pow(w, 1 - flatten) * jitter;
      });
      const sum = raw.reduce((a, b) => a + b, 0);
      const options = q.options.map((o, i) => ({ id: o.id, label: o.label, description: o.description, p: raw[i] / sum }));
      answers[q.id] = { options, chosen: argmax(options) };
    }
    const inputTokens = Math.round((text.length + JSON.stringify(req.questions).length) / 4);
    await new Promise((r) => setTimeout(r, 30 + Math.random() * 60));
    return {
      answers,
      latencyMs: 120 + Math.round(hash(text) * 80),
      inputTokens,
      costUsd: inputTokens * USD_PER_INPUT_TOKEN,
      model: this.model,
      by: 'mock',
    };
  }
}

// ---------------------------------------------------------------- drex

const BASE = 'https://console.nace.ai';

class Limiter {
  private active = 0;
  private queue: (() => void)[] = [];
  constructor(private max: number) {}
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) await new Promise<void>((r) => this.queue.push(r));
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      this.queue.shift()?.();
    }
  }
}

export class DrexDecider implements Decider {
  readonly mode = 'drex' as const;
  private limiter = new Limiter(6); // free tier allows 8 in flight
  constructor(private key: string, readonly model: string) {}

  /** Pick a model id from the live catalog rather than trusting a hard-coded one. */
  static async create(key: string, preferred?: string): Promise<DrexDecider> {
    let model = preferred || '';
    if (!model) {
      try {
        const res = await fetch(`${BASE}/v1/models`, { headers: { Authorization: `Bearer ${key}` } });
        const body: any = await res.json();
        // The catalog is { models: [{ name, alias_for, ... }] }; retired names are aliases, so skip them.
        const list: any[] = body.models ?? body.data ?? [];
        const ids: string[] = list.filter((m) => typeof m === 'string' || !m.alias_for).map((m) => (typeof m === 'string' ? m : m.name ?? m.id)).filter(Boolean);
        model = ids.find((id) => /^drex-max-v/.test(id)) ?? ids.find((id) => id.startsWith('drex-max') && !id.includes('finance')) ?? ids.find((id) => id.startsWith('drex-')) ?? 'drex-latest';
        console.log(`[drex] models: ${ids.join(', ')} -> using ${model}`);
      } catch (e) {
        model = 'drex-latest';
        console.warn('[drex] could not list models, using drex-latest:', (e as Error).message);
      }
    }
    return new DrexDecider(key, model);
  }

  async ask(req: AskRequest): Promise<AskResult> {
    return this.limiter.run(() => this.call(req));
  }

  private async call(req: AskRequest): Promise<AskResult> {
    const questions: Record<string, unknown> = {};
    for (const q of req.questions) {
      const criteria: Record<string, string> = {};
      for (const o of q.options) criteria[o.id] = o.description;
      questions[q.id] = { type: 'choice', instructions: q.instructions, criteria };
    }
    const body = JSON.stringify({ model: this.model, state: req.state, questions });
    const started = Date.now();
    let lastError = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      let res: Response;
      try {
        res = await fetch(`${BASE}/v1/systemone`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
          body,
          signal: AbortSignal.timeout(60_000),
        });
      } catch (e) {
        lastError = (e as Error).message;
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      if (res.status === 429 || res.status === 500 || res.status === 529) {
        const wait = Number(res.headers.get('retry-after-ms')) || 800 * (attempt + 1);
        lastError = `HTTP ${res.status}`;
        await new Promise((r) => setTimeout(r, Math.min(wait, 5000) + Math.random() * 200));
        continue;
      }
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(`Drex ${res.status}: ${JSON.stringify(json).slice(0, 400)} (request_id ${json.request_id ?? 'n/a'})`);
      }
      if (json.model && json.model !== this.model && this.model !== 'drex-latest') {
        console.warn(`[drex] asked for ${this.model} but ${json.model} answered`);
      }
      const answers: Record<string, Answer> = {};
      for (const q of req.questions) {
        const a = json.answers?.[q.id];
        if (!a || !a.probabilities) throw new Error(`Drex returned no probabilities for ${q.id}`);
        const options = q.options.map((o) => ({ id: o.id, label: o.label, description: o.description, p: Number(a.probabilities[o.id] ?? 0) }));
        const chosen = q.options.some((o) => o.id === a.choice) ? a.choice : argmax(options);
        answers[q.id] = { options, chosen };
      }
      const inputTokens = Number(json.usage?.input_tokens ?? 0);
      return {
        answers,
        latencyMs: Date.now() - started,
        inputTokens,
        costUsd: inputTokens * USD_PER_INPUT_TOKEN,
        model: json.model ?? this.model,
        by: 'drex',
      };
    }
    throw new Error(`Drex unavailable after retries: ${lastError}`);
  }
}

export async function createDecider(): Promise<Decider> {
  const key = process.env.NACE_API_KEY || process.env.DREX_API_KEY || '';
  const want = (process.env.DECIDER || (key ? 'drex' : 'mock')).toLowerCase();
  if (want === 'drex') {
    if (!key) {
      console.warn('[decider] DECIDER=drex but no NACE_API_KEY set; using the mock decider');
      return new MockDecider();
    }
    return DrexDecider.create(key, process.env.DREX_MODEL || undefined);
  }
  return new MockDecider();
}
