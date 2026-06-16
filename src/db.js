import Dexie from "dexie";

export const db = new Dexie("taskflow");

db.version(1).stores({
  tasks: "id, projectId, due, status, priority, completed, createdAt",
  projects: "id, name",
});

const LEGACY_KEY = "taskapp:data:v2";

export async function migrateFromLocalStorage() {
  const count = await db.tasks.count();
  if (count > 0) return;

  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);

    const tasks = (data.tasks || []).map(t => ({
      notes: "", start: null, status: "planned", ...t,
      labels: t.labels || [],
      subtasks: (t.subtasks || []).map(s => ({ start: null, due: null, ...s })),
    }));
    const projects = data.projects || [];

    await db.projects.bulkPut(projects);
    await db.tasks.bulkPut(tasks);
    localStorage.removeItem(LEGACY_KEY);
  } catch {}
}
