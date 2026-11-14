// The after-action report: the debrief a staff ride ends with.
// Preferred writer: Intern (github.com/nace-ai/intern) running headless in the run's folder,
// with Drex as its System 1 and a DeepInfra model as its System 2. Intern reads the decision
// log and writes after-action.md itself. On Windows Intern needs tools/intern-windows-shim.
// If Intern is missing or fails, the same DeepInfra model writes the report directly;
// with no key at all, a plain template is used. state.report says which one wrote it.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { Report } from '../shared/types.ts';
import { chat, deepinfraModel, hasDeepInfra } from './llm.ts';

const TASK = `You are the historian on a staff ride. The file battle-log.json in this folder is the record of a simulated replay of a historical battle in which every commander was an AI agent and a human may have taken over some of them. Read it once, in full, then write the after-action report to a new file named after-action.md in this folder.

The report is for the people who just played. Use only facts in battle-log.json; do not add history that is not in the file. Markdown, under 450 words, with these sections:
# After-action report
## What happened (the day in five or six sentences, with clock times)
## Where this departed from 1863 (each decision whose matches_history is false, or that a human made: who, what they chose, what the record says the real commander did, and what followed on the ground)
## The ground at dusk (each objective: who holds it now against who held it historically; casualties)
## Lessons for a commander (three short, specific points drawn from this run's decisions and their consequences)

When the file is written, reply with the single word DONE.`;

function internCommand(): string | null {
  if (process.env.INTERN_CMD) return process.env.INTERN_CMD;
  if (process.platform === 'win32') {
    // Intern needs the shim in tools/intern-windows-shim to start on Windows.
    const exe = path.join(process.env.USERPROFILE ?? '', '.local', 'bin', 'intern.exe');
    return fs.existsSync(exe) ? exe : null;
  }
  return 'intern';
}

/**
 * Runs Intern on the run folder. Intern writes after-action.md and then carries on for a while
 * (its closing reply, System 1's checks), so we do not wait for the process to exit: as soon as
 * the file is on disk and has stopped growing, the report is taken and the process is ended.
 */
function runIntern(cwd: string, file: string, timeoutMs = 300_000): Promise<{ ok: boolean; note: string }> {
  return new Promise((resolve) => {
    const cmd = internCommand();
    if (!cmd) return resolve({ ok: false, note: 'Intern is not installed' });
    if (!process.env.NACE_API_KEY || !process.env.DEEPINFRA_API_KEY) return resolve({ ok: false, note: 'Intern needs NACE_API_KEY and DEEPINFRA_API_KEY' });
    const args = ['-p', '--system1', process.env.INTERN_SYSTEM1 || 'drex-latest', '--system2', `deepinfra/${deepinfraModel()}`, '--no-session', '--no-memory', '--max-turns', '8', '--', TASK];
    let out = '';
    let settled = false;
    let lastSize = -1;
    // PYTHONUTF8: on Windows Intern prints characters the console code page cannot encode.
    const child = spawn(cmd, args, { cwd, env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' }, shell: false });
    const finish = (r: { ok: boolean; note: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer); clearInterval(watch);
      try { child.kill(); } catch { /* already gone */ }
      resolve(r);
    };
    const watch = setInterval(() => {
      try {
        const size = fs.statSync(file).size;
        if (size > 300 && size === lastSize) finish({ ok: true, note: 'ok' });
        lastSize = size;
      } catch { /* not written yet */ }
    }, 900);
    const timer = setTimeout(() => finish({ ok: false, note: 'Intern timed out' }), timeoutMs);
    child.stdout.on('data', (b) => (out += b));
    child.stderr.on('data', (b) => (out += b));
    child.on('error', (e) => finish({ ok: false, note: `Intern could not start: ${e.message}` }));
    child.on('close', (code) => finish({ ok: code === 0 && fs.existsSync(file), note: code === 0 ? 'ok' : `Intern exited ${code}: ${out.slice(-300)}` }));
  });
}

function template(log: any): string {
  const diverged = (log.decisions as any[]).filter((d) => d.matches_history === false || d.by === 'human');
  const lines = [
    '# After-action report', '',
    `**${log.battle}, ${log.date}.** Simulated to ${log.ended_at}. Decider: ${log.mode === 'drex' ? log.model : 'offline mock'}.`, '',
    '## Where this departed from 1863', '',
    ...(diverged.length
      ? diverged.map((d) => `- **${d.time}, ${d.who}:** chose "${d.chose}"${d.by === 'human' ? ' (a human player)' : ''}${d.historical ? `; the record says: "${d.historical}"` : ''}.`)
      : ['- Nothing: every scored decision matched the record.']),
    '', '## The ground at dusk', '',
    ...(log.objectives as any[]).map((o) => `- **${o.name}:** ${o.holder} (in 1863: ${o.historical})`),
    '', `Losses: about ${log.casualties.confederate} Confederate, ${log.casualties.union} Union.`, '',
    `History fidelity: ${log.fidelity.matched} of ${log.fidelity.decided} documented decisions reproduced.`,
  ];
  return lines.join('\n');
}

export async function writeReport(runId: string, log: any, set: (r: Report) => void): Promise<void> {
  set({ status: 'writing' });
  const dir = path.join(process.cwd(), 'data', 'runs', runId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'battle-log.json'), JSON.stringify(log, null, 1));
  const file = path.join(dir, 'after-action.md');
  try { fs.rmSync(file, { force: true }); } catch { /* fresh */ }

  const intern = await runIntern(dir, file);
  if (intern.ok && fs.existsSync(file)) {
    return set({ status: 'done', by: 'intern', markdown: fs.readFileSync(file, 'utf8'), note: `Written by Intern (System 1: Drex, System 2: ${deepinfraModel()} on DeepInfra)` });
  }
  if (hasDeepInfra()) {
    try {
      const out = await chat([
        { role: 'system', content: 'You are the historian on a staff ride. Write in plain, exact prose. Use only the facts given.' },
        { role: 'user', content: `${TASK.replace(/ to a new file named after-action\.md in this folder/, '').replace(/When the file is written.*$/, 'Reply with the report in Markdown and nothing else.')}\n\nbattle-log.json:\n${JSON.stringify(log).slice(0, 60_000)}` },
      ], { maxTokens: 1600, temperature: 0.4, timeoutMs: 120_000, reasoning: 'none' });
      if (out?.text) {
        fs.writeFileSync(file, out.text);
        return set({ status: 'done', by: 'template', markdown: out.text, note: `Written by ${deepinfraModel()} on DeepInfra (${intern.note})` });
      }
    } catch (e) { console.warn('[report]', (e as Error).message); }
  }
  const md = template(log);
  fs.writeFileSync(file, md);
  set({ status: 'done', by: 'template', markdown: md, note: `Template report (${intern.note}; ${hasDeepInfra() ? 'the DeepInfra model did not answer in time' : 'no DeepInfra key'})` });
}
