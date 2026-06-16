# Design Spec: Sections, Subtasks, Reminders, and TaskRow Inline Editing

This document outlines the changes to support empty sections, inline subtask title editing, local browser notifications for task reminders, and full inline editing of parent tasks directly in the main lists.

## Proposed Changes

### 1. Database & Store Layer (IndexedDB)
* Subtasks nested inside tasks will have an optional `note` string field.
* Tasks will support a `reminders` array:
  ```json
  [
    {
      "id": "rem_12345",
      "time": 1781682400000,
      "fired": false
    }
  ]
  ```
* New actions:
  * `addReminder(taskId, timestamp)`
  * `deleteReminder(taskId, reminderId)`
  * `markReminderFired(taskId, reminderId)`

### 2. Sidebar & Section Management (Desktop + Mobile)
* Render sections from the explicit `sections` database list rather than deriving them from existing projects.
* Render empty sections with an italicized "No projects" placeholder.
* Replace the global "+ Add Project" button with an inline "+ Add Project" CTA at the bottom of each section list. Hitting `Enter` saves the project to that section.
* Add a "+ Add Section" button at the bottom of the sidebar to create empty sections inline.

### 3. Inline Subtask Title Editing
* Subtask titles in the detail view are rendered as borderless, auto-resizing textareas that auto-save on input (`onChange`).
* All options (status checkbox, priority flag, start date, due date) are interactive inline via popovers.
* Subtask deletion occurs instantly *without* confirmation prompt.

### 4. Parent Task inline editing inside `TaskRow` (Main List Page)
* Clicking blank space in `TaskRow` opens the Detail Pane (`onOpen(task)`). Clicking inputs/buttons stops propagation.
* Task title and note are rendered as borderless textareas directly in `TaskRow`.
  * Title: Updates `task.title` on input.
  * Note: Rendered below title. Visible if it exists or when row is hovered/focused.
* Meta badges (due date badge, status badge, label chips) are clickable popover triggers inside `TaskRow`.
* Hovering over `TaskRow` reveals a quick action bar with:
  * Calendar icon (WhenPicker popover)
  * Tag icon (Labels popover)
  * Flag icon (Priority popover)
  * Trash icon (deletes task after confirmation prompt `window.confirm`)
* Deleting a main task always requires confirmation; deleting subtasks does not.

### 5. Background Reminders Service
* A background poller runs every 10 seconds.
* Prompts for browser notification permissions.
* Triggers a system notification, in-app toast fallback, and a synth beep sound when a reminder becomes due.
