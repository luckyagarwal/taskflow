import Dexie from "dexie";

export const db = new Dexie("taskflow");

db.version(3).stores({
  tasks: "id, projectId, dueOffset, status, priority, done, createdAt",
  projects: "id, name",
  labels: "id, name",
  sections: "id, name"
});
