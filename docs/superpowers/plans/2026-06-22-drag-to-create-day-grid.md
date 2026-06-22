# Drag/Tap to Create a Task on the Day Grid — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user create a timed, sized task directly on the Day grid — drag out a range on desktop, tap a slot on mobile — opening the composer prefilled with the start time and duration.

**Architecture:** Pure geometry helpers in `timegrid.js` turn pixels into a snapped `{startMin, durationMin}` range. `DayView` adds a gesture layer over the existing `.tl-track` that calls the store's `setQuickAdd(prefill)` with a `{dueOffset, time, duration}` object. The composer already gated by `quickAdd` is extended to read that prefill and to write `duration` on create. No data-model change — tasks already carry `time` and `duration`.

**Tech Stack:** React (function components, hooks), plain ES modules, `node --test` for unit tests, existing app CSS in `src/index.css`.

---

## File Structure

- `src/timegrid.js` (modify) — add pure helpers `yToMin`, `snapMin`, `makeRange`. No React. Unit-tested.
- `tests/timegrid.test.mjs` (create) — unit tests for the three helpers.
- `src/composer.jsx` (modify) — `InlineComposer` accepts `defaultTime` / `defaultDuration` and writes `duration` on create; `QuickAddModal` accepts a `prefill` prop.
- `src/App.jsx` (modify, line ~934) — pass `prefill` into `QuickAddModal`.
- `src/MobileApp.jsx` (modify, lines ~409, ~719) — `QuickAddSheet` accepts and forwards `prefill`.
- `src/timeline.jsx` (modify, `DayView`) — gesture layer (desktop drag + mobile tap) and ghost block.
- `src/index.css` (modify) — `.tl-ghost` style.

The store needs **no** change: `quickAdd` is `useState(false)` (`store.jsx:98`) and already holds any value we pass. We only change what producers pass and what consumers read.

---

## Task 1: Pure geometry helpers in `timegrid.js`

**Files:**
- Modify: `src/timegrid.js`
- Test: `tests/timegrid.test.mjs`

Background: the grid is 60px per hour (`--hour-height: 60px`, `HOUR_H = 60`), so at the default scale one vertical pixel equals one minute — but the helpers must take `hourH` as a parameter, not assume 60. A day is 0–1439 minutes.

- [ ] **Step 1: Write the failing tests**

Create `tests/timegrid.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { yToMin, snapMin, makeRange } from "../src/timegrid.js";

test("yToMin converts pixels to minutes at 60px/hour", () => {
  assert.equal(yToMin(0, 60), 0);
  assert.equal(yToMin(60, 60), 60);   // 1 hour down
  assert.equal(yToMin(545, 60), 545); // 9:05
});

test("yToMin scales with a different hour height", () => {
  assert.equal(yToMin(120, 120), 60); // 120px/hour -> 120px is 1 hour
});

test("yToMin clamps to the day", () => {
  assert.equal(yToMin(-10, 60), 0);
  assert.equal(yToMin(99999, 60), 1439);
});

test("snapMin rounds to the nearest step", () => {
  assert.equal(snapMin(547, 5), 545);
  assert.equal(snapMin(548, 5), 550);
  assert.equal(snapMin(543, 5), 545);
});

test("snapMin clamps to the day", () => {
  assert.equal(snapMin(-3, 5), 0);
  assert.equal(snapMin(1439, 5), 1440 > 1439 ? 1439 : 1440); // see clamp note
});

test("makeRange snaps both edges and gives start + duration", () => {
  const r = makeRange(547, 605, { step: 5, minDur: 5 });
  assert.deepEqual(r, { startMin: 545, durationMin: 60 }); // 545 -> 605
});

test("makeRange normalizes an upward drag", () => {
  const r = makeRange(605, 547, { step: 5, minDur: 5 });
  assert.deepEqual(r, { startMin: 545, durationMin: 60 });
});

test("makeRange enforces a minimum duration", () => {
  const r = makeRange(540, 541, { step: 5, minDur: 5 });
  assert.deepEqual(r, { startMin: 540, durationMin: 5 });
});

test("makeRange keeps start + duration within the day", () => {
  const r = makeRange(1438, 1439, { step: 5, minDur: 30 });
  assert.equal(r.startMin + r.durationMin <= 1440, true);
});
```

Note on the `snapMin` clamp: clamp the snapped value to the range `[0, 1435]` so a 5-minute block can still fit before midnight. Adjust the test assertion to `assert.equal(snapMin(1439, 5), 1435)` when you implement (the line above is a reminder, not the final assertion).

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/timegrid.test.mjs`
Expected: FAIL — `yToMin`, `snapMin`, `makeRange` are not exported.

- [ ] **Step 3: Implement the helpers**

Append to `src/timegrid.js`:

```js
// Pixel offset within the track -> minute of day (0..1439), scaled by hour height.
export function yToMin(y, hourH) {
  const min = Math.round((y / hourH) * 60);
  return Math.max(0, Math.min(1439, min));
}

// Round a minute value to the nearest `step`, clamped so a step-sized block
// still fits before midnight.
export function snapMin(min, step = 5) {
  const snapped = Math.round(min / step) * step;
  return Math.max(0, Math.min(1440 - step, snapped));
}

// Two raw minute values (drag start/end, any order) -> a clean snapped range.
export function makeRange(aMin, bMin, { step = 5, minDur = 5 } = {}) {
  let lo = snapMin(Math.min(aMin, bMin), step);
  let hi = snapMin(Math.max(aMin, bMin), step);
  let durationMin = Math.max(minDur, hi - lo);
  if (lo + durationMin > 1440) lo = Math.max(0, 1440 - durationMin);
  return { startMin: lo, durationMin };
}
```

Then fix the two reminder assertions in the test to the real clamp value:
`assert.equal(snapMin(1439, 5), 1435);` and keep the day-bound test as written.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/timegrid.test.mjs`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/timegrid.js tests/timegrid.test.mjs
git commit -m "feat(timegrid): pixel->minute helpers with snapping and range"
```

---

## Task 2: Composer accepts time/duration prefill and writes duration

**Files:**
- Modify: `src/composer.jsx` — `InlineComposer` (signature at line 448, `submit` at ~497, `reset` at ~496) and `QuickAddModal` (line 685).

This has no unit test (it is UI state wiring); it is verified manually in Task 5's preview pass. Keep the change minimal and follow the existing precedence: a time typed into the title still wins over the prefill.

- [ ] **Step 1: Add props and duration state to `InlineComposer`**

Change the signature (line 448):

```js
export function InlineComposer({ defaultProject = 'inbox', defaultStart = null, defaultDue = null, defaultTime = null, defaultDuration = null, variant = 'inline', autoOpen = false, onDone }) {
```

Change the `time` state initializer (line 455) and add a `duration` state right after it:

```js
  const [time, setTime] = useState(defaultTime);
  const [duration, setDuration] = useState(defaultDuration);
```

- [ ] **Step 2: Carry duration through reset and submit**

Update `reset` (line ~496) to restore both defaults:

```js
  const reset = () => { setTitle(''); setNote(''); setStart(defaultStart); setDue(defaultDue); setTime(defaultTime); setDuration(defaultDuration); setPrio(4); setLabels([]); setProject(defaultProject); setParsed(null); };
```

Update the `addTask({...})` call inside `submit` (line ~503) to include `duration`:

```js
    addTask({
      title: taskData.content,
      note: note.trim(),
      startOffset: start,
      dueOffset: taskData.dueOffset !== null ? taskData.dueOffset : due,
      time: taskData.time || time || null,
      duration: duration || null,
      priority: taskData.priority !== 4 ? taskData.priority : prio,
      projectId: taskData.projectId || project,
      labels: taskData.labels.length ? taskData.labels : labels,
      recurring: taskData.recurring
    });
```

- [ ] **Step 3: Add a `prefill` prop to `QuickAddModal`**

Replace `QuickAddModal` (line 685) with:

```js
export function QuickAddModal({ onClose, defaultProject = 'inbox', defaultDue = null, prefill = null }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="scrim" style={{ position: 'absolute', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10%', zIndex: 200 }} onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ width: 'min(580px,92vw)', animation: 'slideUp .16s ease' }}>
        <InlineComposer
          variant="modal"
          autoOpen
          defaultProject={defaultProject}
          defaultDue={prefill && prefill.dueOffset != null ? prefill.dueOffset : defaultDue}
          defaultTime={prefill ? prefill.time : null}
          defaultDuration={prefill ? prefill.duration : null}
          onDone={onClose}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify the build still compiles**

Run: `npm run build` (or `npx vite build`)
Expected: build succeeds, no syntax errors. (Behavior is verified in Task 5.)

- [ ] **Step 5: Commit**

```bash
git add src/composer.jsx
git commit -m "feat(composer): accept time/duration prefill, write duration on create"
```

---

## Task 3: Wire the prefill object into desktop and mobile composers

**Files:**
- Modify: `src/App.jsx:934`
- Modify: `src/MobileApp.jsx` (line ~409 `QuickAddSheet`, line ~719 render)

Producers will call `setQuickAdd({ dueOffset, time, duration })`. The global "+" button keeps calling `setQuickAdd(true)`. So consumers must pass the object through only when it is an object.

- [ ] **Step 1: Pass prefill on desktop**

In `src/App.jsx`, replace line 934:

```jsx
      {quickAdd && <QuickAddModal prefill={typeof quickAdd === 'object' ? quickAdd : null} onClose={() => setQuickAdd(false)} />}
```

- [ ] **Step 2: Forward prefill into the mobile sheet**

In `src/MobileApp.jsx`, change `QuickAddSheet` (line 409) to take a `prefill` prop and pass it to its `InlineComposer` (line ~435):

```jsx
function QuickAddSheet({ onClose, prefill = null }) {
```

and replace its `InlineComposer` line with:

```jsx
        <InlineComposer
          variant="modal"
          autoOpen
          defaultDue={prefill && prefill.dueOffset != null ? prefill.dueOffset : 0}
          defaultTime={prefill ? prefill.time : null}
          defaultDuration={prefill ? prefill.duration : null}
          onDone={onClose}
        />
```

- [ ] **Step 3: Pass prefill at the render site**

In `src/MobileApp.jsx`, replace line 719:

```jsx
      {quickAdd && <QuickAddSheet prefill={typeof quickAdd === 'object' ? quickAdd : null} onClose={() => setQuickAdd(false)} />}
```

- [ ] **Step 4: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/MobileApp.jsx
git commit -m "feat(composer): thread quickAdd prefill object into desktop and mobile"
```

---

## Task 4: Ghost block style

**Files:**
- Modify: `src/index.css` (near the `.tl-block` rules, ~line 499)

- [ ] **Step 1: Add the `.tl-ghost` style**

Append after the `.tl-block-time` rule:

```css
.tl-ghost {
  position: absolute;
  border-radius: 10px;
  border: 2px dashed var(--accent);
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  color: var(--accent);
  padding: 5px 11px;
  box-sizing: border-box;
  font-weight: 650;
  font-size: 12px;
  pointer-events: none;
  font-variant-numeric: tabular-nums;
  z-index: 5;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/index.css
git commit -m "style(timeline): ghost block for drag-to-create"
```

---

## Task 5: Gesture layer in `DayView`

**Files:**
- Modify: `src/timeline.jsx` (`DayView`)

This is the interactive core. Desktop: pointer drag on empty grid space draws a ghost and, on release past a movement threshold, opens the composer prefilled. Mobile (`compact === true`): a tap on empty space opens the composer with a 60-minute default. Both end with `setQuickAdd({ dueOffset: selOff, time, duration })`. Starting a gesture on an existing `.tl-block` is ignored so task-open still works.

- [ ] **Step 1: Pull `setQuickAdd` from the store and add gesture state**

At the top of `DayView`, extend the `useApp()` destructure (currently `const { tasks, setSelectedId } = useApp();`):

```js
  const { tasks, setSelectedId, setQuickAdd } = useApp();
```

Add imports at the top of the file (extend the existing `timegrid.js` import):

```js
import { layoutDayTasks, fmtHM, parseHM, yToMin, makeRange } from './timegrid.js';
```

Add gesture state alongside the other `useState` hooks in `DayView`:

```js
  const [drag, setDrag] = useState(null); // { startMin, curMin } while dragging (desktop)
  const trackRef = useRef(null);
```

- [ ] **Step 2: Add gesture handlers (place above the `return`)**

```js
  // Convert a pointer/click event to a minute within the track.
  const eventToMin = (clientY) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return yToMin(clientY - rect.top, HOUR_H);
  };

  // True when the event landed on an existing task block (do not start create).
  const onBlock = (target) => !!(target.closest && target.closest('.tl-block'));

  // Mobile: a tap on empty space creates a default 1-hour block.
  const handleTap = (e) => {
    if (onBlock(e.target)) return;
    const { startMin, durationMin } = makeRange(eventToMin(e.clientY), eventToMin(e.clientY) + 60, { step: 5, minDur: 60 });
    setQuickAdd({ dueOffset: selOff, time: fmtHM(startMin), duration: durationMin });
  };

  // Desktop drag.
  const handleDown = (e) => {
    if (onBlock(e.target)) return;
    if (e.button !== undefined && e.button !== 0) return; // left button only
    const m = eventToMin(e.clientY);
    setDrag({ startMin: m, curMin: m });
    e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handleMove = (e) => {
    if (!drag) return;
    setDrag((d) => (d ? { ...d, curMin: eventToMin(e.clientY) } : d));
  };
  const handleUp = () => {
    if (!drag) return;
    const moved = Math.abs(drag.curMin - drag.startMin);
    const d = drag;
    setDrag(null);
    if (moved < 6) return; // plain click, not a drag — ignore
    const { startMin, durationMin } = makeRange(d.startMin, d.curMin, { step: 5, minDur: 5 });
    setQuickAdd({ dueOffset: selOff, time: fmtHM(startMin), duration: durationMin });
  };
```

- [ ] **Step 3: Attach handlers to `.tl-track` and add the ghost**

Add a `ref` and the handlers to the `.tl-track` div. Mobile uses `onClick`; desktop uses the pointer trio. Replace the opening `.tl-track` tag:

```jsx
          <div
            className="tl-track"
            ref={trackRef}
            style={{ height: 24 * HOUR_H }}
            {...(compact
              ? { onClick: handleTap }
              : { onPointerDown: handleDown, onPointerMove: handleMove, onPointerUp: handleUp })}
          >
```

Add the ghost block just before the closing `</div>` of `.tl-track` (after the `tl-now` block), so it renders on top while dragging:

```jsx
            {drag && (() => {
              const { startMin, durationMin } = makeRange(drag.startMin, drag.curMin, { step: 5, minDur: 5 });
              const moved = Math.abs(drag.curMin - drag.startMin) >= 6;
              if (!moved) return null;
              return (
                <div className="tl-ghost" style={{
                  top: (startMin / 60) * HOUR_H,
                  height: Math.max(20, (durationMin / 60) * HOUR_H - 3),
                  left: 72,
                  width: 'calc(100% - 80px)',
                }}>
                  {fmtHM(startMin)} – {fmtHM(startMin + durationMin)} · {H.fmtDuration(durationMin)}
                </div>
              );
            })()}
```

- [ ] **Step 4: Verify in the preview (desktop)**

Start the dev server (`preview_start`), open the Day view.
- Drag on empty grid space: a dashed ghost follows the pointer showing a snapped range; release opens the composer with the start time and duration prefilled. Type a title, confirm — a sized block appears at that time.
- A plain click (no movement) on empty space: nothing happens.
- Click an existing block: that task opens (unchanged).
- Drag upward: range normalizes (start is the earlier time).

Use `preview_console_logs` to confirm no errors and `preview_screenshot` to capture the ghost + the created block.

- [ ] **Step 5: Verify in the preview (mobile)**

Resize to a phone width (`preview_resize`, ~390px) so `compact` is active and the Day view renders.
- Tap an empty slot: the composer sheet opens prefilled with that time and a 1-hour duration; the grid still scrolls normally by dragging.
- Tap an existing block: that task opens.

Capture a `preview_screenshot` of the prefilled sheet.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including `tests/timegrid.test.mjs`.

- [ ] **Step 7: Commit**

```bash
git add src/timeline.jsx
git commit -m "feat(timeline): drag-to-create on desktop, tap-to-create on mobile Day grid"
```

---

## Self-Review

**Spec coverage:**
- Desktop drag-to-select → Task 5 (handlers + ghost). ✓
- 5-minute snapping → Task 1 (`snapMin`/`makeRange`), used in Task 5. ✓
- Open composer prefilled, nothing saved until confirm → Tasks 2–3 (prefill props) + existing modal cancel behavior. ✓
- Mobile tap-to-create, 60-min default, no scroll conflict → Task 5 `handleTap` (uses `onClick`, no drag). ✓
- New `duration` field on create → Task 2. ✓
- `setQuickAdd` carries a prefill object; "+" still works → Tasks 2–3 (consumers branch on `typeof === 'object'`); no store change needed. ✓
- Ignore plain clicks / gestures on existing blocks / upward drag / day-edge clamp → Task 5 (`moved < 6`, `onBlock`, `makeRange` normalize + clamp). ✓
- Created task uses the viewed day (`selOff`) → Task 5 (`dueOffset: selOff`). ✓
- Unit tests for the pure helpers → Task 1. ✓
- Out of scope (month calendar, move/resize, multi-day) → not in any task. ✓

**Placeholder scan:** none — every code step has full code.

**Type/name consistency:** `yToMin`, `snapMin`, `makeRange` defined in Task 1 and imported/used with the same names and signatures in Task 5. `defaultTime`/`defaultDuration` defined in Task 2 and passed in Task 3. `prefill` shape `{ dueOffset, time, duration }` is produced in Task 5 and consumed in Tasks 2–3. `HOUR_H` is the existing constant in `timeline.jsx`. `H.fmtDuration` is the existing helper used elsewhere in the same file. Consistent.
