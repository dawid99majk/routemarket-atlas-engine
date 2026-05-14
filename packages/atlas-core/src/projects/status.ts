import { join } from "node:path";
import type { RouteProject } from "../models/route-project.js";
import { readJsonFile, writeJsonFile } from "../storage/json.js";

export async function updateProjectStatus(project: RouteProject, status: string): Promise<RouteProject> {
  const updated: RouteProject = {
    ...project,
    status,
    updatedAt: new Date().toISOString()
  };
  await writeJsonFile(join(project.folderPath, "project.json"), updated);
  return updated;
}

export async function readProjectStatus(projectFolder: string): Promise<RouteProject> {
  return readJsonFile<RouteProject>(join(projectFolder, "project.json"));
}
