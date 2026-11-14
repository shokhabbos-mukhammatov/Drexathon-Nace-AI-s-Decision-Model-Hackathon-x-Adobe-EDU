import { useCallback, useEffect, useRef, useState } from 'react';
import { MAP_H, MAP_W } from './geo';

/**
 * Zoom and pan for the map. The view is the window of the 1600 x 1000 map that is on screen:
 * its top-left corner (x, y) and the zoom k (1 is the whole map, exactly as before). The SVG
 * layers show it through their viewBox, so the vector map stays sharp at any zoom, and the
 * soldiers' canvas draws through the same window.
 */
export interface View { x: number; y: number; k: number }

export const MAX_ZOOM = 5;
const HOME: View = { x: 0, y: 0, k: 1 };

function clampView(v: View): View {
  const k = Math.max(1, Math.min(MAX_ZOOM, v.k));
  const w = MAP_W / k;
  const h = MAP_H / k;
  return { k, x: Math.max(0, Math.min(MAP_W - w, v.x)), y: Math.max(0, Math.min(MAP_H - h, v.y)) };
}

/** Zoom by `factor` keeping the map point under (fx, fy), fractions of the frame, where it is. */
function zoomAbout(v: View, factor: number, fx: number, fy: number): View {
  const mx = v.x + fx * (MAP_W / v.k);
  const my = v.y + fy * (MAP_H / v.k);
  const k = Math.max(1, Math.min(MAX_ZOOM, v.k * factor));
  return clampView({ k, x: mx - fx * (MAP_W / k), y: my - fy * (MAP_H / k) });
}

export function viewBox(v: View): string {
  return `${v.x.toFixed(2)} ${v.y.toFixed(2)} ${(MAP_W / v.k).toFixed(2)} ${(MAP_H / v.k).toFixed(2)}`;
}

/** A map point in the coordinates of the unzoomed frame, for placing HTML cards over the map. */
export function project(v: View, x: number, y: number): [number, number] {
  return [(x - v.x) * v.k, (y - v.y) * v.k];
}

export function useMapView() {
  const [view, setView] = useState<View>(HOME);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  // A drag that moved the map should not also count as a click on it.
  const dragged = useRef(false);

  // Wheel: zoom about the pointer. Attached by hand because React's wheel listener is passive.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const fx = (e.clientX - r.left) / r.width;
      const fy = (e.clientY - r.top) / r.height;
      const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
      setView((v) => zoomAbout(v, Math.exp(-dy * 0.0018), fx, fy));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Drag to pan, once zoomed in.
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 || viewRef.current.k <= 1) return;
    const el = frameRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const start = { cx: e.clientX, cy: e.clientY, v: viewRef.current };
    dragged.current = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - start.cx;
      const dy = ev.clientY - start.cy;
      if (!dragged.current && Math.hypot(dx, dy) < 5) return;
      dragged.current = true;
      el.classList.add('is-panning');
      const v = start.v;
      setView(clampView({ k: v.k, x: v.x - (dx / r.width) * (MAP_W / v.k), y: v.y - (dy / r.height) * (MAP_H / v.k) }));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      el.classList.remove('is-panning');
      setTimeout(() => (dragged.current = false), 0);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, []);

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (dragged.current) { e.stopPropagation(); e.preventDefault(); }
  }, []);

  const zoomBy = useCallback((factor: number) => setView((v) => zoomAbout(v, factor, 0.5, 0.5)), []);
  const reset = useCallback(() => setView(HOME), []);

  return { view, frameRef, onPointerDown, onClickCapture, zoomBy, reset };
}
