import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mkdir, readFile, stat, writeFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
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
import { routesPath } from "./paths.js";

export class PostgresProjectRepository implements ProjectRepository {
  private client: SupabaseClient;

  constructor(
    supabaseUrl: string,
    supabaseServiceRoleKey: string,
    private readonly mirrorRootDir?: string
  ) {
    this.client = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false
      }
    });
  }

  getProjectPath(slug: string): string {
    return this.mirrorRootDir ? routesPath(this.mirrorRootDir, slug) : slug;
  }

  async createProject(input: CreateProjectInput): Promise<RouteProject> {
    const now = new Date().toISOString();
    const slug = slugify(input.title);

    const { data: existing, error: existingError } = await this.client
      .from("atlas_projects")
      .select("slug")
      .eq("slug", slug)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) throw new ProjectAlreadyExistsError(slug);

    const project = RouteProjectSchema.parse({
      id: slug,
      topicId: input.topicId,
      title: input.title,
      slug,
      category: input.category ?? this.inferCategory(input.title),
      region: input.region ?? "unknown",
      language: input.language ?? "en",
      status: "research_needed",
      folderPath: this.getProjectPath(slug),
      createdAt: now,
      updatedAt: now
    });

    const { error: projectError } = await this.client
      .from("atlas_projects")
      .insert({
        slug,
        data: project,
        updated_at: now
      });

    if (projectError) throw projectError;

    await this.ensureMirrorDirs(slug);
    await this.mirrorJson(slug, "project.json", project);

    await Promise.all([
      this.saveInputManifest(slug, { projectId: project.id, updatedAt: now, items: [] }),
      this.saveArtifact(slug, "creator_answers", { projectId: project.id, updatedAt: now, answers: [] }),
      this.saveApprovals(slug, { projectId: project.id, updatedAt: now, approvals: [] }),
      this.writeProjectFile(slug, "brief.md", this.starterBrief(project)),
      this.saveSources(slug, []),
      this.saveArtifact(slug, "tips", []),
      this.saveArtifact(slug, "recommendations", []),
      this.saveSummary(slug, {
        riskLevel: "unknown",
        validationStatus: "needs_validation",
        hasElevation: false,
        hasTime: false,
        isLoop: false,
        routeSegments: [],
        warnings: [],
        updatedAt: now
      }),
      this.saveArtifact(slug, "media/manifest", { assets: [], updatedAt: now }),
      this.writeProjectFile(slug, "notes.md", this.starterNotes(project)),
      this.saveClaims(slug, []),
      this.writeProjectFile(slug, "poi.geojson", this.starterPoiGeoJson()),
      this.writeProjectFile(slug, "route_concept.md", this.starterRouteConcept(project)),
      this.writeProjectFile(slug, "quality_report.md", this.starterQualityReport()),
      this.writeProjectFile(slug, "review_checklist.md", this.starterReviewChecklist()),
      this.writeProjectFile(slug, "media/license_report.md", "# Media License Report\n\nNo media assets yet.\n"),
      this.saveEvents(slug, [])
    ]);

    return project;
  }

  async getProject(slug: string): Promise<RouteProject> {
    const { data, error } = await this.client
      .from("atlas_projects")
      .select("data")
      .eq("slug", slug)
      .single();

    if (error || !data) throw new Error(`Project ${slug} not found.`);
    return RouteProjectSchema.parse(data.data);
  }

  async saveProject(project: RouteProject): Promise<void> {
    const { error } = await this.client
      .from("atlas_projects")
      .upsert({
        slug: project.slug,
        data: project,
        updated_at: new Date().toISOString()
      });
    if (error) throw error;
    await this.mirrorJson(project.slug, "project.json", project);
  }

  async listProjects(): Promise<RouteProject[]> {
    const { data, error } = await this.client
      .from("atlas_projects")
      .select("data")
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return (data || []).map((d: any) => RouteProjectSchema.parse(d.data));
  }

  async deleteProject(slug: string): Promise<void> {
    const { error: artifactsError } = await this.client
      .from("atlas_artifacts")
      .delete()
      .eq("project_slug", slug);

    if (artifactsError) throw artifactsError;

    const { error: projectError } = await this.client
      .from("atlas_projects")
      .delete()
      .eq("slug", slug);

    if (projectError) throw projectError;

    if (this.mirrorRootDir) {
      await rm(this.getProjectPath(slug), { recursive: true, force: true });
    }
  }

  async loadSources(slug: string): Promise<Source[]> {
    return this._loadArtifactInternal(slug, "sources", z.array(SourceSchema), []);
  }

  async saveSources(slug: string, sources: Source[]): Promise<void> {
    await this.saveArtifact(slug, "sources", sources);
  }

  async loadClaims(slug: string): Promise<Claim[]> {
    return this._loadArtifactInternal(slug, "claims", z.array(ClaimSchema), []);
  }

  async saveClaims(slug: string, claims: Claim[]): Promise<void> {
    await this.saveArtifact(slug, "claims", claims);
  }

  async loadApprovals(slug: string): Promise<any> {
    return this._loadArtifactInternal(slug, "approvals", z.any(), { projectId: slug, approvals: [] });
  }

  async saveApprovals(slug: string, approvals: any): Promise<void> {
    await this.saveArtifact(slug, "approvals", approvals);
  }

  async loadSummary(slug: string): Promise<RouteSummary | undefined> {
    return this._loadArtifactInternal(slug, "route_summary", z.any(), undefined);
  }

  async saveSummary(slug: string, summary: RouteSummary): Promise<void> {
    await this.saveArtifact(slug, "route_summary", summary);
  }

  async loadWorkflowState(slug: string): Promise<any> {
    return this._loadArtifactInternal(slug, "workflow_state", z.any(), { completedSteps: [] });
  }

  async saveWorkflowState(slug: string, state: any): Promise<void> {
    await this.saveArtifact(slug, "workflow_state", state);
  }

  async loadMissingInputs(slug: string): Promise<any> {
    return this._loadArtifactInternal(slug, "missing_inputs", z.any(), { missing: [] });
  }

  async saveMissingInputs(slug: string, missing: any): Promise<void> {
    await this.saveArtifact(slug, "missing_inputs", missing);
  }

  async loadReviewDecision(slug: string): Promise<any> {
    return this._loadArtifactInternal(slug, "review_decision", z.any(), undefined);
  }

  async saveReviewDecision(slug: string, decision: any): Promise<void> {
    await this.saveArtifact(slug, "review_decision", decision);
  }

  async loadEvents(slug: string): Promise<ProjectEvent[]> {
    return this._loadArtifactInternal(slug, "events", z.array(z.any()), []);
  }

  async saveEvents(slug: string, events: ProjectEvent[]): Promise<void> {
    await this.saveArtifact(slug, "events", events);
  }

  async loadInputManifest(slug: string): Promise<InputManifest> {
    return this._loadArtifactInternal(slug, "input_manifest", InputManifestSchema, { projectId: slug, updatedAt: new Date().toISOString(), items: [] });
  }

  async saveInputManifest(slug: string, manifest: InputManifest): Promise<void> {
    await this.saveArtifact(slug, "input_manifest", manifest);
  }

  async readProjectFile(slug: string, file: string): Promise<string> {
    const { data, error } = await this.client
      .from("atlas_artifacts")
      .select("data,type")
      .eq("project_slug", slug)
      .in("type", artifactKeysForFile(file))
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return typeof data.data === "string" ? data.data : `${JSON.stringify(data.data, null, 2)}\n`;
    }

    const mirrored = await this.readMirrorFile(slug, file);
    if (mirrored !== undefined) return mirrored;
    throw new Error(`File ${file} not found in project ${slug}.`);
  }

  async writeProjectFile(slug: string, file: string, content: string): Promise<void> {
    const { error } = await this.client
      .from("atlas_artifacts")
      .upsert({
        project_slug: slug,
        type: `file:${file}`,
        data: content,
        updated_at: new Date().toISOString()
      });
    if (error) throw error;

    const artifactType = artifactTypeFromFile(file);
    if (artifactType) {
      try {
        await this.saveArtifactRow(slug, artifactType, JSON.parse(content));
      } catch {
        // Keep raw file content when an editable JSON artifact is temporarily invalid.
      }
    }

    await this.mirrorText(slug, file, content);
  }

  async exists(slug: string, file: string): Promise<boolean> {
    const { data } = await this.client
      .from("atlas_artifacts")
      .select("type")
      .eq("project_slug", slug)
      .in("type", artifactKeysForFile(file))
      .maybeSingle();

    if (data) return true;
    return this.mirrorExists(slug, file);
  }

  async saveArtifact(slug: string, type: string, data: any): Promise<void> {
    await this.saveArtifactRow(slug, type, data);
    const file = fileFromArtifactType(type);
    if (file) await this.mirrorJson(slug, file, data);
  }

  async loadArtifact(slug: string, type: string): Promise<any> {
    return this._loadArtifactInternal(slug, type, z.any(), undefined);
  }

  private async _loadArtifactInternal<T>(slug: string, type: string, schema: z.ZodSchema<T>, defaultValue: T): Promise<T> {
    const { data, error } = await this.client
      .from("atlas_artifacts")
      .select("data")
      .eq("project_slug", slug)
      .eq("type", type)
      .maybeSingle();

    if (error || !data) {
      const file = fileFromArtifactType(type);
      if (file) {
        try {
          const mirrored = await this.readMirrorFile(slug, file);
          if (mirrored !== undefined) return schema.parse(JSON.parse(mirrored));
        } catch {}
      }
      return defaultValue;
    }
    try {
      return schema.parse(data.data);
    } catch {
      return defaultValue;
    }
  }

  private async saveArtifactRow(slug: string, type: string, data: any): Promise<void> {
    if (slug === "__system__") await this.ensureSystemProject();
    const { error } = await this.client
      .from("atlas_artifacts")
      .upsert({
        project_slug: slug,
        type,
        data,
        updated_at: new Date().toISOString()
      });
    if (error) throw error;
  }

  private async ensureSystemProject(): Promise<void> {
    const now = new Date().toISOString();
    const project = RouteProjectSchema.parse({
      id: "__system__",
      title: "Atlas system state",
      slug: "__system__",
      category: "system",
      region: "internal",
      language: "en",
      status: "research_needed",
      folderPath: this.getProjectPath("__system__"),
      createdAt: now,
      updatedAt: now
    });
    const { error } = await this.client
      .from("atlas_projects")
      .upsert({
        slug: "__system__",
        data: project,
        updated_at: now
      });
    if (error) throw error;
  }

  private async ensureMirrorDirs(slug: string): Promise<void> {
    if (!this.mirrorRootDir) return;
    const base = this.getProjectPath(slug);
    await Promise.all([
      mkdir(join(base, "media"), { recursive: true }),
      mkdir(join(base, "input", "notes"), { recursive: true }),
      mkdir(join(base, "input", "docs"), { recursive: true }),
      mkdir(join(base, "input", "photos"), { recursive: true }),
      mkdir(join(base, "input", "gpx"), { recursive: true }),
      mkdir(join(base, "input", "links"), { recursive: true }),
      mkdir(join(base, "research", "deep"), { recursive: true })
    ]);
  }

  private async mirrorJson(slug: string, file: string, data: unknown): Promise<void> {
    await this.mirrorText(slug, file, `${JSON.stringify(data, null, 2)}\n`);
  }

  private async mirrorText(slug: string, file: string, content: string): Promise<void> {
    if (!this.mirrorRootDir) return;
    await this.ensureMirrorDirs(slug);
    const path = join(this.getProjectPath(slug), file);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf8");
  }

  private async readMirrorFile(slug: string, file: string): Promise<string | undefined> {
    if (!this.mirrorRootDir) return undefined;
    try {
      return await readFile(join(this.getProjectPath(slug), file), "utf8");
    } catch {
      return undefined;
    }
  }

  private async mirrorExists(slug: string, file: string): Promise<boolean> {
    if (!this.mirrorRootDir) return false;
    try {
      await stat(join(this.getProjectPath(slug), file));
      return true;
    } catch {
      return false;
    }
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
    return JSON.stringify({ type: "FeatureCollection", features: [] }, null, 2) + "\n";
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

function artifactTypeFromFile(file: string): string | undefined {
  if (file === "media/manifest.json") return "media/manifest";
  if (!file.endsWith(".json") || file.includes("/")) return undefined;
  return file.slice(0, -".json".length);
}

function fileFromArtifactType(type: string): string | undefined {
  if (type === "media/manifest") return "media/manifest.json";
  if (type.startsWith("file:")) return type.slice("file:".length);
  if (type.includes("/")) return undefined;
  return `${type}.json`;
}

function artifactKeysForFile(file: string): string[] {
  const keys = [`file:${file}`];
  const artifactType = artifactTypeFromFile(file);
  if (artifactType) keys.push(artifactType);
  return keys;
}
