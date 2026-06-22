// drag.jsx — unified pointer-based drag for moving/reordering task cards.
//
// Works with both touch and mouse (the native HTML5 draggable API does not fire
// on touch). Touch: long-press a card to lift it. Mouse: press and move past a
// small threshold. While lifted, a floating clone follows the pointer and the
// hovered column highlights; on release over a column we report the drop.
//
// Markup contract:
//   - a draggable card sets    data-drag-item="<taskId>"
//   - a drop column sets       data-drop-zone="<zoneKey>"
//   - a horizontal scroller can set data-drag-scroll-x for edge auto-scroll
//
// onDrop(draggedId, zoneKey, beforeId) fires on a valid release. beforeId is the
// task to insert before, or null to append at the end of that zone.
import React, { useCallback, useEffect, useRef, useState } from 'react';

const LONG_PRESS_MS = 360;   // touch: hold this long to lift
const MOVE_THRESHOLD = 6;    // mouse: move this many px to lift
const SCROLL_CANCEL = 10;    // touch: moving this far before lift = a scroll, abort
const EDGE = 56;             // px from a scroller edge that triggers auto-scroll
const EDGE_SPEED = 14;       // px per frame of auto-scroll

function hitTest(x, y, draggedId) {
  const stack = document.elementsFromPoint(x, y);
  let zoneEl = null;
  for (const el of stack) {
    if (el instanceof HTMLElement && el.dataset.dropZone != null) { zoneEl = el; break; }
  }
  if (!zoneEl) return { zone: null, beforeId: null };
  const items = [...zoneEl.querySelectorAll('[data-drag-item]')]
    .filter((el) => el.dataset.dragItem !== draggedId);
  let beforeId = null;
  for (const el of items) {
    const r = el.getBoundingClientRect();
    if (y < r.top + r.height / 2) { beforeId = el.dataset.dragItem; break; }
  }
  return { zone: zoneEl.dataset.dropZone, beforeId };
}

export function useDragSort({ onDrop }) {
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  // drag === null when idle. While lifted: { id, label, x, y, zone, beforeId, live }
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  dragRef.current = drag;
  const start = useRef(null);   // { id, label, x0, y0, lpTimer, lifted }
  const moved = useRef(false);
  const rafRef = useRef(0);
  const liftRef = useRef(() => {}); // set by the mount effect, used by onPointerDown

  // Window listeners are attached once and no-op while idle (start.current null),
  // so a press that begins after mount is always tracked — including the
  // move-to-lift on mouse, which happens before any state change.
  useEffect(() => {
    const stopAuto = () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = 0; };
    const autoScroll = (x, y) => {
      stopAuto();
      const tick = () => {
        const sx = document.querySelector('[data-drag-scroll-x]');
        if (sx) {
          if (x > window.innerWidth - EDGE) sx.scrollLeft += EDGE_SPEED;
          else if (x < EDGE) sx.scrollLeft -= EDGE_SPEED;
        }
        const doc = document.scrollingElement || document.documentElement;
        if (y > window.innerHeight - EDGE) doc.scrollTop += EDGE_SPEED;
        else if (y < EDGE) doc.scrollTop -= EDGE_SPEED;
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };
    const lift = (x, y) => {
      const s = start.current;
      if (!s || s.lifted) return;
      s.lifted = true;
      moved.current = false;
      if (navigator.vibrate) navigator.vibrate(12);
      const { zone, beforeId } = hitTest(x, y, s.id);
      setDrag({ id: s.id, label: s.label, x, y, zone, beforeId, live: true });
    };
    liftRef.current = lift;

    const finish = (commit) => {
      stopAuto();
      const s = start.current;
      if (s && s.lpTimer) clearTimeout(s.lpTimer);
      const d = dragRef.current;
      if (commit && d && d.live && d.zone != null && moved.current) {
        onDropRef.current(d.id, d.zone, d.beforeId);
      }
      start.current = null;
      moved.current = false;
      setDrag(null);
    };

    const onMove = (e) => {
      const s = start.current;
      if (!s) return;
      if (!s.lifted) {
        const dist = Math.abs(e.clientX - s.x0) + Math.abs(e.clientY - s.y0);
        if (e.pointerType !== 'touch') {
          if (dist > MOVE_THRESHOLD) lift(e.clientX, e.clientY); else return;
        } else {
          if (dist > SCROLL_CANCEL && s.lpTimer) { clearTimeout(s.lpTimer); s.lpTimer = null; }
          return;
        }
      }
      e.preventDefault();
      moved.current = true;
      const { zone, beforeId } = hitTest(e.clientX, e.clientY, s.id);
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, zone, beforeId } : d));
      autoScroll(e.clientX, e.clientY);
    };
    const onUp = () => finish(true);
    const onKey = (e) => { if (e.key === 'Escape') finish(false); };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      stopAuto();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // Spread onto each draggable card. `label` is shown in the floating clone.
  const itemProps = useCallback((id, label) => ({
    'data-drag-item': id,
    onPointerDown: (e) => {
      if (e.button != null && e.button !== 0) return; // left button / touch only
      start.current = { id, label, x0: e.clientX, y0: e.clientY, lifted: false, lpTimer: null };
      if (e.pointerType === 'touch') {
        const { clientX, clientY } = e;
        start.current.lpTimer = setTimeout(() => liftRef.current(clientX, clientY), LONG_PRESS_MS);
      }
    },
    onClickCapture: (e) => {
      // swallow the click that ends a real drag, so it doesn't open the task
      if (moved.current) { e.preventDefault(); e.stopPropagation(); moved.current = false; }
    },
  }), []);

  return { drag, itemProps, dragging: !!(drag && drag.live) };
}

// Floating clone that follows the pointer during a drag.
export function DragGhost({ drag }) {
  if (!drag || !drag.live) return null;
  return (
    <div style={{
      position: 'fixed', left: 0, top: 0, zIndex: 9999, pointerEvents: 'none',
      transform: `translate(${drag.x + 12}px, ${drag.y - 16}px)`,
      maxWidth: 260, padding: '8px 12px', borderRadius: 10,
      background: 'var(--bg-elev)', border: '1px solid var(--border-2)',
      boxShadow: 'var(--shadow-md)', color: 'var(--text)',
      fontSize: 13.5, fontWeight: 600, opacity: 0.95,
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    }}>
      {drag.label}
    </div>
  );
}
