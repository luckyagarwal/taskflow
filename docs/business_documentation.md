# Casex Tasks — Business Documentation

## 1. Product Vision & Mission
**Casex Tasks** is a high-fidelity, privacy-first, local-first task management application designed for developers, creators, and professionals who demand instant responsiveness, natural capture, and powerful organization.

The product's core belief is that task management software should get out of the user's way. By leveraging natural language processing and local database storage, Casex Tasks offers a zero-friction experience that works offline and keeps data secure on the user's device.

---

## 2. Core Business Principles
* **Privacy-First**: No remote database tracking by default. All data resides in the user's browser via IndexedDB.
* **Speed**: Millisecond-level interactions. No API roundtrips for page switches, task completion, or editing.
* **Frictionless Capture**: The parser extracts priority, project, labels, dates, and times from a single line of text.
* **Flexibility**: Clean, structural categorization through Sections and Projects, alongside hierarchical subtask systems.

---

## 3. Product Structure & Taxonomy

### The Task
The atomic unit of work. Every task contains:
* **Title**: Clear action item.
* **Note / Description**: Detailed context.
* **Priority (P1 - P4)**: P1 (Critical/Red) to P4 (Default/Muted).
* **Status**: Planned, In Progress, Blocked, Waiting, or Done.
* **Temporal bounds**: Optional start date, due date, time, and recurrence rules (e.g. `every day`).
* **Categorization**: Optional tags/labels and exactly one Project.
* **Reminders**: Specific alerts scheduled for the task.
* **Subtasks**: Child task items with their own status, priority, dates, titles, and descriptions.

### Projects & Sections
To maintain scalability, tasks are organized into a strict hierarchy:
* **Sections**: High-level domains of life/work (e.g. "Work", "Personal"). A section can exist empty.
* **Projects**: Focused work tracks (e.g. "Launch Campaign", "Health"). A project *cannot* exist without a section; it must belong to one.
* **Inbox**: The default home for projects and tasks that have not been categorized.

---

## 4. Key User Workflows
1. **Quick Capture**: Pressing `⌘K` or clicking "+ Add Task" opens the natural language composer. The user types `Review PR tomorrow at 10am @Work p1` and hits `Enter`. The task is parsed and scheduled instantly.
2. **Review & Refine**: The user clicks a task to expand it inline (Desktop) or slides it open (Mobile) to add notes, create subtasks, schedule reminders, or modify tags.
3. **Daily Planning**: Using the "Today" and "Upcoming" views, users review scheduled tasks, custom-sort them using drag-and-drop to design their day, and log their progress.

---

## 5. Pricing & Tiers
* **Casex Tasks** is a unified premium experience. There are no "Personal Free" or restricted feature tiers. Users have full, unrestricted access to the entire local-first workspace.
