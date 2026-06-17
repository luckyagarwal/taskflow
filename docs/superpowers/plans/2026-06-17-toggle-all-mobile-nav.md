# Keyboard Shortcuts, Option-Click Toggle, and Navigation Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Notion-style section collapsing/expansion keyboard shortcuts, Option+Click toggling for tasks and subtasks, Mac-style global shortcuts, and depth styling for desktop sidebar and mobile header.

**Architecture:** Integrate global state for section collapsing in `store.jsx` to support keydown events in `App.jsx`. Bind events and propagate `e.altKey` to subtask checkbox handlers. Apply border/shadow enhancements in CSS/inline styles.

**Tech Stack:** React 18, Vite, CSS variables.

---

### Task 1: Store & Global Section Collapse State

**Files:**
- Modify: `src/store.jsx`

- [ ] **Step 1: Add collapsedSections state and toggleSection callback**
  Update state and context object returned by `useStore`.
  Code change to add:
  ```javascript
  const [collapsedSections, setCollapsedSections] = useState([]);
  const toggleSection = useCallback((id) => {
    setCollapsedSections((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);
  ```
  Ensure these are exported in context object.

- [ ] **Step 2: Commit Store updates**
  Run: `git commit -am "feat: add global section collapse state to store"`

---

### Task 2: View Components Section Integration

**Files:**
- Modify: `src/views.jsx`

- [ ] **Step 1: Replace local collapse states in TodayView, UpcomingView, ProjectView, LogbookView**
  Use `collapsedSections` and `toggleSection` from `useApp()`.
  Identify sections:
  - TodayView: `today-overdue`, `today-today`.
  - UpcomingView: `upcoming-${off}`.
  - ProjectView: `project-scheduled`, `project-anytime`, `project-someday`.
  - LogbookView: `logbook-${k}`.
  Update Settings keyboard shortcuts list to show Mac shortcuts (`Cmd + Option + C`, `Cmd + Option + U`, `Cmd + Enter`, `Cmd + Option + T`) and remove Windows keys.

- [ ] **Step 2: Verify compilation**
  Run: `npm run build`

- [ ] **Step 3: Commit Views integration**
  Run: `git commit -am "feat: migrate section collapse states to global store and update Settings"`

---

### Task 3: Checkbox & Click Propagation

**Files:**
- Modify: `src/ui.jsx`
- Modify: `src/views.jsx`
- Modify: `src/detail.jsx`

- [ ] **Step 1: Pass click event from Checkbox**
  Update `Checkbox` click handler to:
  ```javascript
  onClick={(e) => { e.stopPropagation(); onToggle && onToggle(e); }}
  ```
  Update `TaskRow` container to have `data-task-id={task.id}`.

- [ ] **Step 2: Implement Option+Click on task row checklist**
  In `views.jsx` `TaskGroup` component, pass `e` to `handleToggle` and check `e.altKey`. If active, toggle all tasks in the group to match state.

- [ ] **Step 3: Implement Option+Click on subtask checkbox**
  In `detail.jsx` `SubtaskItem` component, change subtask checkbox click to check `e.altKey` and toggle all subtasks of the task.

- [ ] **Step 4: Commit UI event propagation**
  Run: `git commit -am "feat: implement Option+Click bulk toggle for tasks and subtasks"`

---

### Task 4: Global Keyboard Shortcuts

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Implement global KeyDown shortcuts**
  Destructure `toggleTask`, `updateSubtask`, `collapsedSections`, `setCollapsedSections`, `toggleSection` from `useApp()`.
  Add key listeners in `handleKeyDown`:
  - `Cmd + Option + C` to complete all.
  - `Cmd + Option + U` to untoggle all.
  - `Cmd + Enter` or `Cmd + Option + T` to toggle collapse/expand of selected task's section (or all sections if none selected).
  Add helper `getSelectedTaskSectionId`.
  Update `useEffect` dependencies.

- [ ] **Step 2: Commit shortcuts**
  Run: `git commit -am "feat: add Mac-style Cmd+Option+C/U/T and Cmd+Enter shortcuts"`

---

### Task 5: Mobile Navigation Depth and Desktop Sidebar Shadow

**Files:**
- Modify: `src/MobileApp.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Add shadow and borders to MobileHeader**
  Set `MobileHeader` background to `var(--bg-elev)`, add bottom border, shadow: `boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)'`.

- [ ] **Step 2: Add shadow and border-right to Sidebar**
  In `src/App.jsx`, add `boxShadow: '4px 0 16px rgba(0, 0, 0, 0.03)'` and `borderRight: '1px solid var(--border-2)'` to `Sidebar`'s container.

- [ ] **Step 3: Run build check**
  Run: `npm run build`

- [ ] **Step 4: Commit styles**
  Run: `git commit -am "style: add depth shadow and border separation to desktop sidebar and mobile header"`
