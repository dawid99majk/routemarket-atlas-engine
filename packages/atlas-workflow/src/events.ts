import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type ProjectEvent = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  data?: Record<string, unknown>;
};

export async function appendProjectEvent(projectFolder: string, event: Omit<ProjectEvent, "id" | "createdAt">): Promise<ProjectEvent> {
  const path = eventsPath(projectFolder);
  const events = await listProjectEvents(projectFolder);
  const saved: ProjectEvent = {
    id: `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...event
  };
  events.push(saved);
  await mkdir(projectFolder, { recursive: true });
  await writeFile(path, `${JSON.stringify(events, null, 2)}\n`, "utf8");
  return saved;
}

export async function listProjectEvents(projectFolder: string): Promise<ProjectEvent[]> {
  try {
    const raw = await readFile(eventsPath(projectFolder), "utf8");
    return JSON.parse(raw) as ProjectEvent[];
  } catch {
    return [];
  }
}

function eventsPath(projectFolder: string): string {
  return join(projectFolder, "events.json");
}
