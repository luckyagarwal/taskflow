# TaskFlow — Documentation

A smart, single-file task manager built in React. Natural-language task entry, projects, tags, priorities, statuses, start/due dates, collapsible subtasks with their own dates, drag-to-reorder, inline editing, and local persistence. No backend or database — all state is serialized to a single key-value store.

---

## 1. Feature Overview

### Task capture
- **Natural-language input.** Type a sentence and the parser extracts structured fields. Example: `Submit report tomorrow at 5pm #Work @Important p1` becomes a task due tomorrow at 17:00, in the Work project, tagged Important, priority 1.
- **Live parse preview.** As you type in the quick-add box, detected date, time, priority, project, and tags appear as chips before you commit.

### Organization
- **Projects.** Color-coded lists in the sidebar. Created explicitly (+ button) or implicitly by typing `#NewName` in quick-add. Deleting a project moves its tasks to Inbox.
- **Tags.** Free-form labels (`@tag`), with suggestions seeded from a default set plus any tags you've used. Filterable from the sidebar.
- **Smart views.** Inbox (tasks with no project), Today (due today or overdue, grouped by date), Upcoming (future, grouped by date), per-project, and per-tag. Search filters across titles and tags.

### Task attributes
- **Priorities** P1–P4, color-coded on the checkbox and flag.
- **Status**: Planned, In Progress, Blocked, Waiting, Done — each with a distinct icon. Setting Done completes the task; completing the checkbox sets Done.
- **Start date + due date**, so a task can span a range (shown as `Start → Due` on the card). Due date also carries an optional time.
- **"Someday"** scheduling option (no concrete date).
- **Recurring tasks** (`every day`, `every week`, `every monday`, `daily/weekly/monthly`). Completing a recurring task rolls its due date forward instead of marking it done.
- **Notes** field per task.

### Subtasks
- Add, complete, edit, delete, and **drag-to-reorder** subtasks.
- Each subtask has its own **start and due date**.
- A progress bar and `done/total` count, shown both on the card and in the editor.
- **Collapsible** subtask section (header with count stays visible when collapsed).

### Editing surfaces
- **Inline expand.** A disclosure triangle on each row expands it in place to edit notes, all attributes, and subtasks — no modal needed (Notion/Things style).
- **Detail modal.** Clicking a task title opens a full-screen modal with the same editor components, kept perfectly in sync with the inline editor.

### Date picker
- Quick options (Today, This Evening, Tomorrow, This Weekend, Next Week, Someday, Clear), a navigable month calendar, and an inline time field.

### Persistence
- All state auto-saves on every change and reloads on launch. Loader normalizes older data so missing fields can't crash the app.

---

## 2. Tech Stack & Requirements

| Concern | Choice |
|---|---|
| UI library | React 18 (functional components + hooks) |
| Icons | `lucide-react` |
| Styling | Inline `style` objects (no CSS framework required) |
| State | Local component state (`useState`, `useMemo`, `useEffect`) |
| Persistence | Single key-value store (`window.storage` in-app; swap for `localStorage` locally) |
| Build (local) | Vite + `@vitejs/plugin-react` |

No router, no global state manager, no backend. The entire app is one component tree in one file.

---

## 3. Running Locally

### Project structure
```
taskflow/
├─ package.json
├─ index.html
├─ vite.config.js
└─ src/
   ├─ main.jsx
   └─ App.jsx        ← the full app code
```

### Install & run
```bash
npm install
npm run dev          # local dev server
npm run build        # production build to /dist
```

### Dependencies
```json
{
  "dependencies": {
    "lucide-react": "^0.383.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.3.1"
  }
}
```

### The one required change for local use
`window.storage` only exists inside the Claude artifact runtime. Replace the load and save effects with `localStorage`:

```js
// LOAD (replace the window.storage.get block)
useEffect(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      setTasks((d.tasks || []).map(t => ({
        notes: "", start: null, status: "planned", ...t,
        labels: t.labels || [],
        subtasks: (t.subtasks || []).map(s => ({ start: null, due: null, ...s })),
      })));
      setProjects(d.projects || seedProjects);
    } else {
      setTasks(seedTasks());
    }
  } catch { setTasks(seedTasks()); }
  setLoaded(true);
}, []);

// SAVE (replace the window.storage.set block)
useEffect(() => {
  if (!loaded) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks, projects }));
}, [tasks, projects, loaded]);
```

`localStorage` is synchronous and has the same read-one-key/write-one-key shape, so nothing else needs to change.

---

## 4. Data Model

State lives in two arrays held by the root `App` component: `tasks` and `projects`. Both are serialized together under one storage key.

### Task
```ts
type Task = {
  id: string;              // "t" + timestamp + random
  content: string;         // title
  notes: string;
  projectId: string | null;// null = Inbox
  labels: string[];        // tag names
  priority: 1 | 2 | 3 | 4; // 1 = highest
  start: string | null;    // "YYYY-MM-DD"
  due:   string | null;    // "YYYY-MM-DD" | "someday"
  time:  string | null;    // "HH:MM" (24h), applies to due
  status: "planned" | "inprogress" | "blocked" | "waiting" | "done";
  subtasks: Subtask[];
  completed: boolean;
  recurring: Recurrence | null;
  createdAt: number;
};
```

### Subtask
```ts
type Subtask = {
  id: string;
  content: string;
  completed: boolean;
  start: string | null;    // "YYYY-MM-DD"
  due:   string | null;    // "YYYY-MM-DD"
};
```

### Project
```ts
type Project = { id: string; name: string; color: string };
```

### Recurrence
```ts
type Recurrence =
  | { type: "day" | "week" | "month" | "year" }
  | { type: "weekday"; dow: number };  // dow: 0=Sun … 6=Sat
```

### Date conventions
- Dates are stored as local `"YYYY-MM-DD"` strings (no timezones, no time component except `time`).
- The sentinel `"someday"` is a valid `due` value meaning "unscheduled but flagged."
- `null` means unset.

---

## 5. Architecture & Key Functions

### Date helpers (top of file)
- `startOfToday()` — midnight today as a `Date`.
- `toISO(date)` / `fromISO(str)` — convert between `Date` and `"YYYY-MM-DD"`. `fromISO` returns `null` for `null`/`"someday"`.
- `addDays(date, n)`.
- `relativeLabel(iso)` — human label: "Today", "Tomorrow", weekday name, or "Mon D". Returns "Someday" for the sentinel.
- `isOverdue(iso)` — true if a real date is before today.
- `fmtTime("HH:MM")` — 12-hour display string.
- `dateRangeLabel(start, due, time)` — `Start → Due` when both set, else the single date (+ time).

### Natural-language parser — `parseTask(raw, projects)`
Returns `{ content, due, time, priority, projectId, labels, recurring }`. It works by progressively matching and stripping tokens from the input, leaving the remainder as the title. Recognized tokens:

| Token | Examples |
|---|---|
| Priority | `p1`–`p4` |
| Tags | `@home`, `@urgent` |
| Project | `#Work` (matches existing or marks `__new__Name`) |
| Recurrence | `every day`, `every monday`, `daily`, `weekly`, `monthly` |
| Time | `at 5pm`, `5:30pm`, `at 17:00`, `9am` |
| Relative dates | `today`, `tomorrow`, `this weekend`, `next week`, `in 3 days`, `next monday` |
| Calendar dates | `jan 5`, `dec 25` |

A project token of the form `__new__Name` signals `addTask` to create the project on the fly.

### Recurrence advance — `advanceRecurring(iso, rule)`
Given the current due date and a rule, returns the next occurrence (used when completing a recurring task).

### Persistence
- Single key: `STORAGE_KEY = "taskapp:data:v2"`.
- Load effect normalizes each loaded task/subtask, filling defaults for any missing fields (forward-compatible with older saves).
- Save effect writes `{ tasks, projects }` after the initial load completes (guarded by a `loaded` flag to avoid overwriting with the empty initial state).

### State actions on `App`
- `addTask(parsed)` — creates a task, auto-creating a project if needed, defaulting project/due from the active view.
- `updateTask(id, patch)` — `patch` is an object or an updater function `(task) => partial`.
- `toggleComplete(id)` — completes, or rolls a recurring task forward; syncs `status`.
- `deleteTask(id)`, `addProject(name)`, `deleteProject(id)`.
- `toggleExpand(id)` — toggles inline expansion (tracked in a `Set`).
- Derived with `useMemo`: `visible` (filtered for current view/search), `counts`, `grouped` (date-grouped for Today/Upcoming), `allLabels`.

---

## 6. Component Map

| Component | Responsibility |
|---|---|
| `App` | Owns all state, persistence, views, and action handlers. |
| `SearchBox`, `NavItem` | Sidebar search and navigation rows. |
| `QuickAdd` | Natural-language input with live parse preview. |
| `TaskRow` | A task in the list: checkbox, metadata, disclosure triangle, and the **inline editor** when expanded. |
| `AttributeBar` | Shared row of editable pills (start, due/when, status, priority, tags, project). Used by both inline rows and the modal. |
| `SubtaskSection` | Shared collapsible subtask list: add, progress, reorder. |
| `SubRow` | One subtask: drag handle, checkbox, text, start/due pickers, delete. |
| `WhenPicker` | Date popover (quick options + `MiniCalendar` + time). |
| `MiniCalendar` | Navigable month grid (Monday-first). |
| `TagPicker` | Tag selector with search and create-new. |
| `Popover`, `PopRow`, `PropPill` | Generic popover primitives and the pill button. |
| `StatusIcon` | Renders the icon for a given status (custom half-circle SVG for In Progress). |
| `TaskDetail` | Full-screen modal wrapping `AttributeBar` + `SubtaskSection`. |
| `EmptyState`, `Chip` | Empty-view messaging and small inline chips. |

**Sharing principle:** `AttributeBar` and `SubtaskSection` are the single source of truth for editing, embedded in both the inline row and the modal — so the two surfaces never diverge.

---

## 7. Styling Notes

- All styling is inline `style={{...}}`. The accent color is `#d1453b` (crimson). Priority and status colors are defined in the `PRIORITY` and `STATUS` constant maps.
- Popovers are dark (`#33312f`) and position relative to their anchor via a wrapping `position: relative` span; `align="right"` flips them to the right edge (used by subtask pickers near the modal edge).
- There are no CSS files and no `localStorage`/`sessionStorage` calls inside artifacts other than the persistence layer described above.

---

## 8. Extension Points / Roadmap

Natural next features and where they'd hook in:

1. **Completed history / archive view** — add a view type that lists `tasks.filter(t => t.completed)`; add a nav item.
2. **Calendar (week/month) view** — reuse `MiniCalendar` logic; render tasks bucketed by `due`.
3. **Drag-to-reorder top-level tasks** — add an `order` field to `Task` and replicate the `SubRow` drag pattern at the list level.
4. **Recurring-task UI editor** — add a recurrence picker to `AttributeBar` (currently set only via natural language).
5. **Dark mode** — introduce a theme object and swap the hard-coded colors; the inline-style approach makes this a find-and-replace of color tokens into a `theme` map.
6. **Mobile layout** — a separate component tree with bottom-tab navigation and full-screen sheets, sharing the same data model and helpers.
7. **Real backend (multi-device sync)** — replace the persistence effects with API calls (e.g., Supabase/Firebase/Postgres). The data model already maps cleanly to two tables (`tasks`, `projects`) with `subtasks` as a JSON column or a third table.

---

## 9. Gotchas

- **Storage API differs by environment.** `window.storage` is async (`await`); `localStorage` is sync. Use the correct one for where you run it.
- **Save guard.** Never remove the `if (!loaded) return;` check in the save effect, or the initial empty state will overwrite stored data on first render.
- **Date math is local-time only.** If you add timezone support, change `toISO`/`fromISO` together.
- **`due === "someday"`** must be guarded anywhere you call `fromISO`/`isOverdue` — these helpers already handle it; preserve that when extending.
