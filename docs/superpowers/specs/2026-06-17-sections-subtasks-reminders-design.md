# Design Spec: Sections, Subtask Descriptions, and Reminders

This document outlines the changes to support empty sections, inline subtask title/description editing, and local browser notifications for task reminders.

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

### 3. Inline Subtask Editing
* Subtask rows in the detail view display the title and a small muted description if `note` is present.
* Clicking the title/description area expands the subtask inline into edit mode.
* In edit mode, the title and note become editable textareas.
* Clicking "Save", pressing `Enter` (when description is empty), or clicking outside auto-saves the edits.

### 4. Background Reminders Service
* A background poller runs every 10 seconds.
* Prompts for browser notification permissions.
* Triggers a system notification, in-app toast fallback, and a synth beep sound when a reminder becomes due.
