import { readFile, writeFile, readdir, mkdir, stat, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { readJsonFile, readJsonFileWithSchema, writeJsonFile, exists } from "./json.js";
import { routesPath } from "./paths.js";
import { 
  RouteProjectSchema, 
  SourceSchema, 
  ClaimSchema, 
  type RouteProject, 
  type Source, 
  type Claim, 
  type RouteSummary,
  InputManifestSchema,
  type InputManifest
} from "../index.js";
import { z } from "zod";
import type { ProjectRepository, CreateProjectInput, ProjectEvent } from "./project-repository.js";
import { slugify } from "../projects/slug.js";
import { ProjectAlreadyExistsError } from "../errors.js";

export class FileProjectRepository implements ProjectRepository {
  constructor(private readonly rootDir: string) {}

  getProjectPath(slug: string): string {
    return routesPath(this.rootDir, slug);
  }

  async createProject(input: CreateProjectInput): Promise<RouteProject> {
    const now = new Date().toISOString();
    const slug = slugify(input.title);
    const folderPath = this.getProjectPath(slug);
    const projectJsonPath = join(folderPath, "project.json");

    try {
      await stat(projectJsonPath);
      throw new ProjectAlreadyExistsError(slug);
    } catch (err: any) {
      if (err.name === "ProjectAlreadyExistsError") throw err;
      if (err.code !== "ENOENT") throw err;
    }

    const project = RouteProjectSchema.parse({
      id: slug,
      topicId: input.topicId,
      title: input.title,
      slug,
      category: input.category ?? this.inferCategory(input.title),
      region: input.region ?? "unknown",
      language: input.language ?? "en",
      status: "research_needed",
      folderPath,
      createdAt: now,
      updatedAt: now
    });

    await mkdir(join(folderPath, "media"), { recursive: true });
    await mkdir(join(folderPath, "input", "notes"), { recursive: true });
    await mkdir(join(folderPath, "input", "docs"), { recursive: true });
    await mkdir(join(folderPath, "input", "photos"), { recursive: true });
    await mkdir(join(folderPath, "input", "gpx"), { recursive: true });
    await mkdir(join(folderPath, "input", "links"), { recursive: true });

    await writeJsonFile(join(folderPath, "project.json"), project);
    await writeJsonFile(join(folderPath, "input_manifest.json"), {
      projectId: project.id,
      updatedAt: now,
      items: []
    });
    await writeJsonFile(join(folderPath, "creator_answers.json"), {
      projectId: project.id,
      updatedAt: now,
      answers: []
    });
    await writeJsonFile(join(folderPath, "approvals.json"), {
      projectId: project.id,
      updatedAt: now,
      approvals: []
    });

    await writeFile(join(folderPath, "brief.md"), this.starterBrief(project), "utf8");
    await writeJsonFile(join(folderPath, "sources.json"), []);
    await writeJsonFile(join(folderPath, "tips.json"), []);
    await writeJsonFile(join(folderPath, "recommendations.json"), []);
    await writeJsonFile(join(folderPath, "route_summary.json"), {
      riskLevel: "unknown",
      validationStatus: "needs_validation",
      updatedAt: now
    });
    await writeJsonFile(join(folderPath, "media", "manifest.json"), { assets: [], updatedAt: now });
    await writeFile(join(folderPath, "notes.md"), this.starterNotes(project), "utf8");
    await writeJsonFile(join(folderPath, "claims.json"), []);
    await writeFile(join(folderPath, "poi.geojson"), this.starterPoiGeoJson(), "utf8");
    await writeFile(join(folderPath, "route_concept.md"), this.starterRouteConcept(project), "utf8");
    await writeFile(join(folderPath, "quality_report.md"), this.starterQualityReport(), "utf8");
    await writeFile(join(folderPath, "review_checklist.md"), this.starterReviewChecklist(), "utf8");
    await writeFile(join(folderPath, "media", "license_report.md"), "# Media License Report\n\nNo media assets yet.\n", "utf8");
    await writeJsonFile(join(folderPath, "events.json"), []);

    return project;
  }

  async getProject(slug: string): Promise<RouteProject> {
    return readJsonFileWithSchema<RouteProject>(join(this.getProjectPath(slug), "project.json"), RouteProjectSchema);
  }

  async saveProject(project: RouteProject): Promise<void> {
    await writeJsonFile(join(this.getProjectPath(project.slug), "project.json"), project);
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
      return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } catch {
      return [];
    }
  }

  async deleteProject(slug: string): Promise<void> {
    await rm(this.getProjectPath(slug), { recursive: true, force: true });
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

  async loadEvents(slug: string): Promise<ProjectEvent[]> {
    const path = join(this.getProjectPath(slug), "events.json");
    if (!(await exists(path))) return [];
    return readJsonFile<ProjectEvent[]>(path);
  }

  async saveEvents(slug: string, events: ProjectEvent[]): Promise<void> {
    await writeJsonFile(join(this.getProjectPath(slug), "events.json"), events);
  }

  async loadInputManifest(slug: string): Promise<InputManifest> {
    const path = join(this.getProjectPath(slug), "input_manifest.json");
    const data = await readJsonFile<unknown>(path);
    return InputManifestSchema.parse(data);
  }

  async saveInputManifest(slug: string, manifest: InputManifest): Promise<void> {
    const path = join(this.getProjectPath(slug), "input_manifest.json");
    await writeJsonFile(path, manifest);
  }

  async readProjectFile(slug: string, file: string): Promise<string> {
    return readFile(join(this.getProjectPath(slug), file), "utf8");
  }

  async writeProjectFile(slug: string, file: string, content: string): Promise<void> {
    const path = join(this.getProjectPath(slug), file);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf8");
  }

  async exists(slug: string, file: string): Promise<boolean> {
    return exists(join(this.getProjectPath(slug), file));
  }

  async loadArtifact(slug: string, type: string): Promise<any> {
    const path = join(this.getProjectPath(slug), `${type}.json`);
    if (!(await exists(path))) return undefined;
    return readJsonFile<any>(path);
  }

  async saveArtifact(slug: string, type: string, data: any): Promise<void> {
    const fileName = `${type}.json`;
    await writeJsonFile(join(this.getProjectPath(slug), fileName), data);
  }

  private inferCategory(title: string): string {
    const lowered = title.toLowerCase();
    if (lowered.includes("motorcycle") || lowered.includes("motocykl")) return "motorcycle";
    if (lowered.includes("cycling") || lowered.includes("bike") || lowered.includes("rower")) return "cycling";
    if (lowered.includes("running") || lowered.includes("run")) return "running";
    if (lowered.includes("city") || lowered.includes("walking") || lowered.includes("walk")) return "city_walk";
    if (lowered.includes("roadtrip") || lowered.includes("drive") || lowered.includes("car")) return "roadtrip";
    return "hiking";
  }

  private starterBrief(project: RouteProject): string {
    return `# Research brief\n\nTopic: ${project.title}\nCategory: ${project.category}\nRegion: ${project.region}\nLanguage: ${project.language}\n\nStatus: needs research\n`;
  }

  private starterNotes(project: RouteProject): string {
    return `# Notes\n\nWorking notes for ${project.title}.\n\n## Source collection\n\nNo sources collected yet.\n`;
  }

  private starterPoiGeoJson(): string {
    return `${JSON.stringify({ type: "FeatureCollection", features: [] }, null, 2)}\n`;
  }

  private starterRouteConcept(project: RouteProject): string {
    return `# Route Concept\n\nTopic: ${project.title}\n\nConcept status: not designed yet.\n`;
  }

  private starterQualityReport(): string {
    return `# Quality Report\n\n## Source coverage\n\nNot collected yet.\n\n## GPX validation\n\nNot available in MVP 1.\n\n## Human review points\n\n- Confirm source coverage.\n- Confirm safety notes.\n- Confirm legal/media status.\n`;
  }

  private starterReviewChecklist(): string {
    return `# Review Checklist\n\n- [ ] Sources collected\n- [ ] Claims verified\n- [ ] Route concept reviewed\n- [ ] GPX validated\n- [ ] Guide reviewed\n- [ ] Media/legal status checked\n- [ ] RouteMarket payload prepared\n`;
  }
}
