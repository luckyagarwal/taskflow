# Casex Tasks — Technical Documentation

## 1. System Architecture
Casex Tasks is built as a single-page React application leveraging a local-first architecture. It features synchronous UI updates backed by an asynchronous database layer powered by IndexedDB.

```
┌────────────────────────────────────────────────────────┐
│                        React UI                        │
│   (App.jsx / MobileApp.jsx / detail.jsx / views.jsx)   │
└───────────────────────────┬────────────────────────────┘
                            │ (useStore Context Hook)
┌───────────────────────────▼────────────────────────────┐
│                   App State Provider                   │
│         (store.jsx — State & Callback Actions)         │
└───────────────────────────┬────────────────────────────┘
                            │ (Dexie.js API)
┌───────────────────────────▼────────────────────────────┐
│                    IndexedDB Engine                    │
│             (db.js — Dexie Schema & Migrations)        │
└────────────────────────────────────────────────────────┘
```

---

## 2. File & Folder Structure
```
taskflow/
├── docs/                      # Business & Technical specs and plans
├── public/                    # Static assets
├── vite.config.js             # Vite development & build configuration
└── src/
    ├── main.jsx               # React DOM bootstrapper
    ├── db.js                  # Dexie.js database schema & initialization
    ├── store.jsx              # React context & global application store hook
    ├── App.jsx                # Desktop UI components & layout shell
    ├── MobileApp.jsx          # Mobile (iOS frame) UI components & layout shell
    ├── detail.jsx             # Task editor pane (inline & modal layouts)
    ├── views.jsx              # Main view panels (Today, Upcoming, Inbox, etc.)
    ├── composer.jsx           # Natural language task compiler & input forms
    ├── calendar.jsx           # Calendar view grid component
    ├── icons.jsx              # Custom Lucide-react wrapper & icons
    ├── ui.jsx                 # Reusable atomic UI elements (buttons, badges)
    └── index.css              # Styling variables & dark/light mode system
```

---

## 3. Database Layer (Dexie.js)
The persistent store runs on **Dexie.js** (IndexedDB).

### Database Schema (Version 3)
```javascript
db.version(3).stores({
  tasks: "id, projectId, dueOffset, status, priority, done, createdAt",
  projects: "id, name",
  labels: "id, name",
  sections: "id, name"
});
```

### Data Models

#### Task (`tasks` store)
```typescript
interface Task {
  id: string;              // Prefix "task_n" + incremental index
  title: string;           // Task name
  note: string;            // Description/Notes field
  projectId: string;       // Foreign key pointing to project (or "inbox")
  dueOffset: number | null;// Days relative to today (0 = today, -1 = yesterday)
  time: string | null;     // Time string "HH:MM" (24h format)
  priority: 1 | 2 | 3 | 4; // Priority scale: 1 is highest, 4 is default
  labels: string[];        // Array of label IDs
  subtasks: Subtask[];     // Nested subtasks list
  done: boolean;           // Completion flag
  doneOffset: number | null;// Completion date offset
  recurring: object | null;// Recurrence rules
  createdAt: number;       // Creation timestamp (ms)
  subtaskSort: string;     // Subtask sort order ("manual", "priority", "created")
  position: number;        // Global positioning weight for custom sorting
  status: string;          // planned, inprogress, blocked, waiting, done
  reminders?: Reminder[];  // List of task reminders
}
```

#### Subtask (nested inside `tasks`)
```typescript
interface Subtask {
  id: string;              // "s" + index
  title: string;           // Subtask name
  note?: string;           // Subtask description
  done: boolean;           // Completion flag
  status: string;          // planned, inprogress, blocked, waiting, done
  priority: number;        // Subtask priority
  startOffset: number | null;// Start date offset
  dueOffset: number | null;// Due date offset
  createdAt: number;       // Creation timestamp
}
```

#### Reminder (nested inside `tasks.reminders`)
```typescript
interface Reminder {
  id: string;              // Prefix "rem_" + timestamp
  time: number;            // Absolute Unix timestamp (ms) when reminder triggers
  fired: boolean;          // True if reminder has been delivered to user
}
```

#### Project (`projects` store)
```typescript
interface Project {
  id: string;              // Prefix "p_" + timestamp
  name: string;            // Project title
  group: string;           // Section name it belongs to (foreign reference)
  color: string;           // Hex color
  parent: string | null;   // Parent project ID (for nesting)
}
```

#### Label (`labels` store)
```typescript
interface Label {
  id: string;              // Prefix "l_" + timestamp + random
  name: string;            // Tag label name
  color: string;           // Hex color
}
```

#### Section (`sections` store)
```typescript
interface Section {
  id: string;              // Prefix "sec_" + timestamp
  name: string;            // Section name (referenced by project.group)
}
```

---

## 4. State & Actions Management (`store.jsx`)
State is served using a React Context. The `useStore` custom hook handles database synchronization, local storage updates, custom selectors, and UI configurations.

### Key Context Methods
* `addTask(partial)`: Parses and saves task, resolving new projects/labels.
* `updateTask(id, patch)`: Modifies task properties and persists to Dexie.
* `addProject(name, group)`: Inserts a project mapped to a section.
* `addSection(name)`: Saves a new section.
* `addReminder(taskId, timestamp)`: Registers a reminder timestamp to a task.
* `deleteReminder(taskId, reminderId)`: Deletes a reminder.
* `updateSubtask(taskId, subId, patch)`: Edits properties (title, note, dates) of a nested subtask.

---

## 5. UI & Styling Framework
* **Theme System**: Premium CSS custom properties defined in `src/index.css`. Includes dark-mode and light-mode mapping.
* **Layouts**:
  * **Desktop**: Three-column responsive grid (Sidebar Navigation, Central Tasks List, Detail Editor pane).
  * **Mobile**: iOS simulated viewport. Tab bar navigation, modal sheets, and floating action button (FAB) for fast capture.
* **Vanilla Styling**: CSS transitions and transform animations (`slideUp`, `scaleIn`) for fluid micro-interactions.
