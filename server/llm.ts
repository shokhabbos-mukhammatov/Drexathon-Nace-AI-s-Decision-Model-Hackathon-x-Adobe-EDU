// The only generative model in Clio: a DeepInfra-hosted model that writes words, never decisions.
// It is called after Drex has decided, to voice the decision as a one-line dispatch.
const BASE = 'https://api.deepinfra.com/v1/openai';
export const deepinfraModel = () => process.env.DEEPINFRA_MODEL || 'Qwen/Qwen3.8-27B';
export const hasDeepInfra = () => !!process.env.DEEPINFRA_API_KEY;

let active = 0;
const waiting: (() => void)[] = [];
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 4) await new Promise<void>((r) => waiting.push(r));
  active++;
  try { return await fn(); } finally { active--; waiting.shift()?.(); }
}

export interface ChatUsage { ms: number; inputTokens: number; outputTokens: number; costUsd: number }

export async function chat(
  messages: { role: 'system' | 'user'; content: string }[],
  opts: { maxTokens?: number; temperature?: number; timeoutMs?: number; reasoning?: 'none' } = {},
): Promise<{ text: string; usage: ChatUsage } | null> {
  const key = process.env.DEEPINFRA_API_KEY;
  if (!key) return null;
  return slot(async () => {
    const started = Date.now();
    const res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      // reasoning_effort 'none' turns off the model's thinking pass: about 1 s a reply against about 10 s.
      body: JSON.stringify({ model: deepinfraModel(), messages, max_tokens: opts.maxTokens ?? 400, temperature: opts.temperature ?? 0.7, ...(opts.reasoning ? { reasoning_effort: opts.reasoning } : {}) }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`DeepInfra ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
    const raw: string = json.choices?.[0]?.message?.content ?? '';
    const text = raw.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^[\s\S]*<\/think>/, '').trim();
    return {
      text,
      usage: {
        ms: Date.now() - started,
        inputTokens: json.usage?.prompt_tokens ?? 0,
        outputTokens: json.usage?.completion_tokens ?? 0,
        costUsd: Number(json.usage?.estimated_cost ?? 0),
      },
    };
  });
}

export async function writeDispatch(d: { name: string; question: string; chosen: string; clock: string; traits: string[] }): Promise<string | null> {
  if (!hasDeepInfra()) return null;
  try {
    const out = await chat([
      { role: 'system', content: 'You write one-line field dispatches for an 1863 battle simulation. Reply with the dispatch only: one sentence, at most 22 words, first person, plain period English, no quotation marks, no preamble. Do not invent facts beyond the decision given.' },
      { role: 'user', content: `Commander: ${d.name}. Time: ${d.clock}. Character: ${d.traits.join('; ') || 'not given'}.\nThe matter before him: ${d.question}\nHe has decided: ${d.chosen}.\nWrite his dispatch.` },
    ], { maxTokens: 160, temperature: 0.8, timeoutMs: 20_000, reasoning: 'none' });
    if (!out?.text) console.warn(`[dispatch] empty reply for ${d.name}`);
    const line = out?.text.split('\n').map((s) => s.trim()).filter(Boolean).pop()?.replace(/^["'“]|["'”]$/g, '');
    return line && line.length < 260 ? line : null;
  } catch (e) {
    console.warn('[dispatch]', (e as Error).message);
    return null;
  }
}
