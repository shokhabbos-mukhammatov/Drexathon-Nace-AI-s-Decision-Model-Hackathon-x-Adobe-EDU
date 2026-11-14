// Clio server: holds the one battle in memory, broadcasts it to every browser tab, takes commands.
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import type { ServerMessage } from '../shared/types.ts';
import { createDecider } from './decider.ts';
import { Game } from './game.ts';
import { writeReport } from './report.ts';
import { hasDeepInfra, deepinfraModel } from './llm.ts';

// Not PORT: dev tooling sets PORT for the Vite client, and the two must not collide.
const PORT = Number(process.env.CLIO_PORT || 8787);
const app = express();
app.use(express.json({ limit: '1mb' }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const sockets = new Map<WebSocket, string>();

let queued = false;
function broadcast() {
  if (queued) return;
  queued = true;
  setTimeout(() => {
    queued = false;
    game.state.clients = sockets.size;
    const msg = JSON.stringify({ type: 'state', state: game.state } satisfies ServerMessage);
    for (const ws of sockets.keys()) if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }, 40);
}

const decider = await createDecider();
const game = new Game(decider, broadcast);
console.log(`[clio] decider: ${decider.mode} (${decider.model}); dispatch writer: ${hasDeepInfra() ? deepinfraModel() + ' on DeepInfra' : 'templates (no DEEPINFRA_API_KEY)'}`);

wss.on('connection', (ws, req) => {
  // A reconnecting tab keeps its id, and with it the commanders it has taken over.
  const asked = new URL(req.url ?? '/', 'http://x').searchParams.get('clientId');
  const clientId = asked && /^[\w-]{4,40}$/.test(asked) ? asked : randomUUID().slice(0, 8);
  sockets.set(ws, clientId);
  ws.send(JSON.stringify({ type: 'hello', clientId } satisfies ServerMessage));
  ws.send(JSON.stringify({ type: 'state', state: game.state } satisfies ServerMessage));
  broadcast();
  ws.on('close', () => {
    sockets.delete(ws);
    // Give a reloading tab a moment to come back before its commanders return to Drex.
    setTimeout(() => { if (![...sockets.values()].includes(clientId)) game.dropClient(clientId); broadcast(); }, 4000);
  });
});

const ok = (res: express.Response, body: unknown = { ok: true }) => res.json(body);

app.get('/api/state', (_req, res) => ok(res, game.state));
app.post('/api/reset', (req, res) => { game.reset(Number(req.body?.seed) || 1863, req.body?.personas !== false); ok(res, game.state); });
app.post('/api/step', (_req, res) => { void game.step(); ok(res); });
app.post('/api/auto', (req, res) => { game.setAuto(!!req.body?.on, Number(req.body?.delayMs) || undefined); ok(res); });
app.post('/api/claim', (req, res) => ok(res, { ok: game.claim(String(req.body?.commanderId), String(req.body?.clientId)) }));
app.post('/api/release', (req, res) => { game.release_(String(req.body?.commanderId), String(req.body?.clientId)); ok(res); });
app.post('/api/choose', (req, res) => ok(res, { ok: game.choose(String(req.body?.pendingId), String(req.body?.optionId)) }));
app.post('/api/typed', async (req, res) => ok(res, await game.typed(String(req.body?.pendingId), String(req.body?.text ?? '').slice(0, 400))));
app.post('/api/explain', async (req, res) => {
  try { const r = await game.explain(String(req.body?.decisionId)); r ? ok(res, r) : res.status(404).json({ error: 'No such decision' }); }
  catch (e) { res.status(503).json({ error: (e as Error).message }); }
});
app.post('/api/council', async (_req, res) => {
  try { ok(res, await game.council()); } catch (e) { res.status(503).json({ error: (e as Error).message }); }
});
app.post('/api/report', (_req, res) => {
  if (game.state.report.status !== 'writing') {
    void writeReport(game.state.runId, game.runLog(), (r) => { game.state.report = r; broadcast(); })
      .catch((e) => { game.state.report = { status: 'error', note: (e as Error).message }; broadcast(); });
  }
  ok(res);
});

// Serve the built frontend when it exists (npm run build), so one process is enough for a demo.
const dist = path.join(process.cwd(), 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api|\/ws).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

server.listen(PORT, () => console.log(`[clio] listening on http://localhost:${PORT}`));
