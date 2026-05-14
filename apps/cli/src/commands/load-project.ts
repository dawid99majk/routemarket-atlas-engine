import { join } from "node:path";
import { readJsonFile, routesPath, type RouteProject, type Source } from "../../../../packages/atlas-core/src/index.js";

export async function loadProject(rootDir: string, slug: string): Promise<RouteProject> {
  return readJsonFile<RouteProject>(join(routesPath(rootDir, slug), "project.json"));
}

export async function loadProjectSources(project: RouteProject): Promise<Source[]> {
  return readJsonFile<Source[]>(join(project.folderPath, "sources.json"));
}
