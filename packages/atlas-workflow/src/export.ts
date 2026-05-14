import { readFile } from "node:fs/promises";
import type { RouteProject } from "../../atlas-core/src/index.js";
import type { ProjectArtifact } from "./artifacts.js";
import type { ProjectEvent } from "./events.js";

export type ProjectExportBundle = {
  exportedAt: string;
  project: RouteProject;
  artifacts: Array<ProjectArtifact & { content?: string }>;
  events: ProjectEvent[];
};

export async function buildProjectExportBundle(input: {
  project: RouteProject;
  artifacts: ProjectArtifact[];
  events: ProjectEvent[];
}): Promise<ProjectExportBundle> {
  const artifacts = await Promise.all(
    input.artifacts.map(async (artifact) => {
      if (!artifact.exists) return artifact;
      try {
        return {
          ...artifact,
          content: await readFile(`${input.project.folderPath}/${artifact.path}`, "utf8")
        };
      } catch {
        return artifact;
      }
    })
  );

  return {
    exportedAt: new Date().toISOString(),
    project: input.project,
    artifacts,
    events: input.events
  };
}
