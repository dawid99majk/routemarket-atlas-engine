import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { readJsonFile, readJsonFileWithSchema, writeJsonFile, exists } from "./json.js";
import { routesPath } from "./paths.js";
import { 
  RouteProjectSchema, 
  SourceSchema, 
  ClaimSchema, 
  type RouteProject, 
  type Source, 
  type Claim, 
  type RouteSummary 
} from "../index.js";
import { z } from "zod";
import type { ProjectStorageAdapter } from "./adapter.js";

export class FileProjectStorage implements ProjectStorageAdapter {
  constructor(private readonly rootDir: string) {}

  getProjectPath(slug: string): string {
    return routesPath(this.rootDir, slug);
  }

  async getProject(slug: string): Promise<RouteProject> {
    return readJsonFileWithSchema<RouteProject>(join(this.getProjectPath(slug), "project.json"), RouteProjectSchema);
  }

  async saveProject(slug: string, project: RouteProject): Promise<void> {
    await writeJsonFile(join(this.getProjectPath(slug), "project.json"), project);
  }

  async listProjects(): Promise<RouteProject[]> {
    const baseDir = routesPath(this.rootDir);
    try {
      const entries = await readdir(baseDir, { withFileTypes: true });
      const slugs = entries.filter(e => e.isDirectory()).map(e => e.name);
      const projects: RouteProject[] = [];
      for (const slug of slugs) {
        try {
          projects.push(await this.getProject(slug));
        } catch {
          // Skip invalid projects
        }
      }
      return projects;
    } catch {
      return [];
    }
  }

  async loadSources(slug: string): Promise<Source[]> {
    const path = join(this.getProjectPath(slug), "sources.json");
    if (!(await exists(path))) return [];
    return readJsonFileWithSchema<Source[]>(path, z.array(SourceSchema));
  }

  async saveSources(slug: string, sources: Source[]): Promise<void> {
    await writeJsonFile(join(this.getProjectPath(slug), "sources.json"), sources);
  }

  async loadClaims(slug: string): Promise<Claim[]> {
    const path = join(this.getProjectPath(slug), "claims.json");
    if (!(await exists(path))) return [];
    return readJsonFileWithSchema<Claim[]>(path, z.array(ClaimSchema));
  }

  async saveClaims(slug: string, claims: Claim[]): Promise<void> {
    await writeJsonFile(join(this.getProjectPath(slug), "claims.json"), claims);
  }

  async loadApprovals(slug: string): Promise<any> {
    const path = join(this.getProjectPath(slug), "approvals.json");
    if (!(await exists(path))) return { projectId: slug, approvals: [] };
    return readJsonFile<any>(path);
  }

  async saveApprovals(slug: string, approvals: any): Promise<void> {
    await writeJsonFile(join(this.getProjectPath(slug), "approvals.json"), approvals);
  }

  async loadSummary(slug: string): Promise<RouteSummary | undefined> {
    const path = join(this.getProjectPath(slug), "route_summary.json");
    if (!(await exists(path))) return undefined;
    return readJsonFile<RouteSummary>(path);
  }

  async saveSummary(slug: string, summary: RouteSummary): Promise<void> {
    await writeJsonFile(join(this.getProjectPath(slug), "route_summary.json"), summary);
  }

  async loadWorkflowState(slug: string): Promise<any> {
    const path = join(this.getProjectPath(slug), "workflow_state.json");
    if (!(await exists(path))) return { completedSteps: [] };
    return readJsonFile<any>(path);
  }

  async saveWorkflowState(slug: string, state: any): Promise<void> {
    await writeJsonFile(join(this.getProjectPath(slug), "workflow_state.json"), state);
  }

  async loadMissingInputs(slug: string): Promise<any> {
    const path = join(this.getProjectPath(slug), "missing_inputs.json");
    if (!(await exists(path))) return { missing: [] };
    return readJsonFile<any>(path);
  }

  async saveMissingInputs(slug: string, missing: any): Promise<void> {
    await writeJsonFile(join(this.getProjectPath(slug), "missing_inputs.json"), missing);
  }

  async loadReviewDecision(slug: string): Promise<any> {
    const path = join(this.getProjectPath(slug), "review_decision.json");
    if (!(await exists(path))) return undefined;
    return readJsonFile<any>(path);
  }

  async saveReviewDecision(slug: string, decision: any): Promise<void> {
    await writeJsonFile(join(this.getProjectPath(slug), "review_decision.json"), decision);
  }

  async readProjectFile(slug: string, file: string): Promise<string> {
    return readFile(join(this.getProjectPath(slug), file), "utf8");
  }

  async writeProjectFile(slug: string, file: string, content: string): Promise<void> {
    await writeFile(join(this.getProjectPath(slug), file), content, "utf8");
  }

  async exists(slug: string, file: string): Promise<boolean> {
    return exists(join(this.getProjectPath(slug), file));
  }
}
