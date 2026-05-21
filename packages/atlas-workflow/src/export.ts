import { readFile } from "node:fs/promises";
import type { ProjectRepository, RouteProject } from "../../atlas-core/src/index.js";
import type { ProjectArtifact } from "./artifacts.js";
import type { ProjectEvent } from "./events.js";

export type ProjectExportBundle = {
  exportedAt: string;
  project: RouteProject;
  artifacts: Array<ProjectArtifact & { content?: string }>;
  events: ProjectEvent[];
  repository?: ProjectRepository;
};

export async function buildProjectExportBundle(input: {
  project: RouteProject;
  artifacts: ProjectArtifact[];
  events: ProjectEvent[];
  repository?: ProjectRepository;
}): Promise<ProjectExportBundle> {
  const artifacts = await Promise.all(
    input.artifacts.map(async (artifact) => {
      if (!artifact.exists) return artifact;
      try {
        return {
          ...artifact,
          content: input.repository
            ? await input.repository.readProjectFile(input.project.id, artifact.path)
            : await readFile(`${input.project.folderPath}/${artifact.path}`, "utf8")
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
