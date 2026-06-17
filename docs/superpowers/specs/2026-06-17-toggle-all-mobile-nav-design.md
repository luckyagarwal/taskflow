# Keyboard Shortcuts, Option-Click Toggle, and Mobile Navigation Separation

Implement Mac-style keyboard shortcuts to toggle/untoggle tasks/subtasks, collapse/expand sections, propagate Option+Click checkbox interaction, and add modern depth/separation to the mobile navigation bar.

## Proposed Design

### 1. Checkbox Interaction Updates

- **Propagate Click Events**: Update the check box component in [ui.jsx](file:///Users/casex/PersonalProject/taskflow/src/ui.jsx) to pass the React event object `e` to the `onToggle` callback.
- **Identifier Attribute**: Add `data-task-id={task.id}` to the task row wrapper so we can query active/visible tasks directly from the DOM for context-aware shortcut actions.

### 2. Alt/Option + Click Toggling

- **Main Task Listing**:
  - In [views.jsx](file:///Users/casex/PersonalProject/taskflow/src/views.jsx), inside `TaskGroup`'s `handleToggle(task, e)`:
    - If `e.altKey` is active, toggle completion status for all tasks in the current group.
    - Animate them out together if completing them, or reactivate them instantly.
- **Subtask List**:
  - In [detail.jsx](file:///Users/casex/PersonalProject/taskflow/src/detail.jsx), inside `SubtaskItem`:
    - Intercept the subtask checkbox/status button click.
    - If `e.altKey` is active, iterate and toggle all subtasks of the active task to matching state.

### 3. Global Keyboard Shortcuts & Section Expansion

- **Toggle completion**:
  - **Option + Command + C** (`⌥⌘C`): Toggle/complete all.
  - **Option + Command + U** (`⌥⌘U`): Untoggle/incomplete all.
- **Section Collapse/Expand**:
  - **ArrowLeft**: Collapse the section of the selected task.
  - **ArrowRight**: Expand the section of the selected task.
  - **Option + Command + E** (`⌥⌘E`): Toggle collapse/expand of all sections in the active view.
- **Store Updates**:
  - Add `collapsedSections` state and `toggleSection` to [store.jsx](file:///Users/casex/PersonalProject/taskflow/src/store.jsx) so collapse/expand state is global and accessible to shortcuts.
- **Contextual Behavior**:
  - If a task is selected (`selectedId` is active), target its subtasks.
  - Otherwise, target all visible tasks in the active listing view.
- **Implementation**:
  - Catch keys in [App.jsx](file:///Users/casex/PersonalProject/taskflow/src/App.jsx) `handleKeyDown`.
  - Block shortcuts when `isEditing` is active.

### 4. Settings Reference Update

- In [views.jsx](file:///Users/casex/PersonalProject/taskflow/src/views.jsx), update the Keyboard Shortcuts Reference block to show Mac-style shortcuts exclusively:
  - `Cmd + K` instead of both `Cmd + K` and `Ctrl + K`.
  - Add `Cmd + Option + C` and `Cmd + Option + U` shortcuts.
  - Add `ArrowLeft / ArrowRight` and `Cmd + Option + E` for sections collapse/expand.

### 5. Mobile Navigation Bar Polish

- Update `MobileHeader` in [MobileApp.jsx](file:///Users/casex/PersonalProject/taskflow/src/MobileApp.jsx):
  - Change background color to `var(--bg-elev)`.
  - Add bottom border `1px solid var(--border-2)`.
  - Add shadow `boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)'` matching the `TabBar`.
