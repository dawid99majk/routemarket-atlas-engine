import { type ProjectEvent, type ProjectRepository } from "../../atlas-core/src/index.js";

export type { ProjectEvent };

export async function appendProjectEvent(slug: string, repository: ProjectRepository, event: Omit<ProjectEvent, "id" | "createdAt">): Promise<ProjectEvent> {
  const events = await repository.loadEvents(slug);
  const saved: ProjectEvent = {
    id: `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...event
  };
  events.push(saved);
  await repository.saveEvents(slug, events);
  return saved;
}

export async function listProjectEvents(slug: string, repository: ProjectRepository): Promise<ProjectEvent[]> {
  return repository.loadEvents(slug);
}
