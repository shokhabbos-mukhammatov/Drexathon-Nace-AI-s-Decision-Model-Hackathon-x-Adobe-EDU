import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState, ServerMessage } from '../../shared/types';

function localId(): string {
  try {
    const k = 'clio.clientId';
    const have = sessionStorage.getItem(k);
    if (have) return have;
    const id = 'staff-' + Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem(k, id);
    return id;
  } catch {
    return 'staff-' + Math.random().toString(36).slice(2, 10);
  }
}

function looksLikeState(x: unknown): x is GameState {
  return !!x && typeof x === 'object' && 'runId' in x && 'nodes' in x && 'units' in x;
}

export interface Game {
  state: GameState | null;
  clientId: string;
  connected: boolean;
  /** POST /api/<path>. Resolves to the parsed JSON, or null on failure. */
  post: <T = unknown>(path: string, body?: unknown) => Promise<T | null>;
}

/** One place for the socket, the first fetch and every command. */
export function useGame(): Game {
  const [state, setState] = useState<GameState | null>(null);
  const [clientId, setClientId] = useState<string>(localId);
  const [connected, setConnected] = useState(false);
  const idRef = useRef(clientId);
  idRef.current = clientId;

  useEffect(() => {
    let closed = false;
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const load = () => {
      fetch('/api/state')
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!closed && looksLikeState(j)) setState(j);
        })
        .catch(() => undefined);
    };

    const connect = () => {
      if (closed) return;
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      try {
        ws = new WebSocket(`${proto}://${location.host}/ws?clientId=${encodeURIComponent(idRef.current)}`);
      } catch {
        schedule();
        return;
      }
      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
        load();
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as ServerMessage;
          if (msg.type === 'hello' && msg.clientId) setClientId(msg.clientId);
          else if (msg.type === 'state' && looksLikeState(msg.state)) setState(msg.state);
        } catch {
          /* ignore a malformed frame */
        }
      };
      ws.onclose = () => {
        setConnected(false);
        schedule();
      };
      ws.onerror = () => {
        try {
          ws?.close();
        } catch {
          /* already closed */
        }
      };
    };

    const schedule = () => {
      if (closed) return;
      attempt += 1;
      clearTimeout(timer);
      timer = setTimeout(connect, Math.min(4000, 400 * attempt));
    };

    load();
    connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      try {
        ws?.close();
      } catch {
        /* already closed */
      }
    };
  }, []);

  const post = useCallback(async <T,>(path: string, body?: unknown): Promise<T | null> => {
    try {
      const r = await fetch('/api/' + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      const j: unknown = await r.json().catch(() => null);
      if (looksLikeState(j)) setState(j);
      return (j as T) ?? null;
    } catch {
      return null;
    }
  }, []);

  return { state, clientId, connected, post };
}

/** Keeps the previous reference while the value is structurally unchanged. */
export function useStable<T>(value: T): T {
  const ref = useRef<{ key: string; value: T } | null>(null);
  const key = JSON.stringify(value ?? null);
  if (!ref.current || ref.current.key !== key) ref.current = { key, value };
  return ref.current.value;
}

/** True once an image at `src` has loaded. */
export function useImageOk(src: string): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let live = true;
    const img = new Image();
    img.onload = () => live && setOk(img.naturalWidth > 0);
    img.onerror = () => live && setOk(false);
    img.src = src;
    return () => {
      live = false;
    };
  }, [src]);
  return ok;
}
