import type { Dirent } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { RouteProject } from "../models/route-project.js";
import { readJsonFile } from "../storage/json.js";
import { routesPath } from "../storage/paths.js";

export async function listRouteProjects(rootDir: string): Promise<RouteProject[]> {
  const routesDir = routesPath(rootDir);
  let entries: Dirent[];
  try {
    entries = await readdir(routesDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const projects = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        try {
          return await readJsonFile<RouteProject>(join(routesDir, entry.name, "project.json"));
        } catch {
          return undefined;
        }
      })
  );

  return projects
    .filter((project): project is RouteProject => Boolean(project))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
