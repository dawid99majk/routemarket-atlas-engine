import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createRouteProject,
  listRouteProjects,
  readJsonFile,
  routesPath,
  updateProjectStatus,
  type RouteProject,
  type Source,
  type Claim
} from "../../atlas-core/src/index.js";
import { prepareRouteMarketDraft } from "../../atlas-publisher/src/index.js";
import { collectSources, discoverDemand, extractPois, generateClaims, getSearchProviderStatus, runDeepResearch } from "../../atlas-research/src/index.js";
import type { SearchProviderMode } from "../../atlas-research/src/index.js";
import {
  generateGuideDraft,
  generateQualityReport,
  generateRecommendations,
  generateResearchBrief,
  generateRouteConcept,
  generateRouteTips,
  prepareMediaPack,
  writeReviewChecklist
} from "../../atlas-writer/src/index.js";
import { listProjectArtifacts } from "./artifacts.js";
import { buildDashboardSummary } from "./dashboard.js";
import { appendProjectEvent, listProjectEvents } from "./events.js";
import { buildProjectExportBundle } from "./export.js";
import { listAtlasCategories } from "./categories.js";
import { filterProjects, type ProjectListFilters } from "./project-filters.js";
import { assessProjectReadiness } from "./readiness.js";
import { buildProjectReviewBundle, saveProjectReviewDecision, type ReviewDecision } from "./review.js";

export type AtlasWorkflowOptions = {
  rootDir: string;
};

export type CreateProjectRequest = {
  topic: string;
  category?: string;
  region?: string;
  language?: string;
};

export type DiscoverRequest = {
  category: string;
  region: string;
  language?: string;
  limit?: number;
};

export type CollectSourcesRequest = {
  provider?: SearchProviderMode;
  limit?: number;
};

export type SubmitReviewDecisionRequest = {
  decision: ReviewDecision;
  reviewer?: string;
  notes?: string;
};

export type RunDeepResearchRequest = {
  sourceLimit?: number;
};

export type WorkflowProgress = {
  message: string;
  progress?: number;
  currentStep?: string;
};

export type WorkflowProgressCallback = (progress: WorkflowProgress) => void;

export class AtlasWorkflowService {
  constructor(private readonly options: AtlasWorkflowOptions) {}

  discover(input: DiscoverRequest) {
    return discoverDemand({
      rootDir: this.options.rootDir,
      category: input.category,
      region: input.region,
      language: input.language ?? "en",
      limit: input.limit ?? 10
    });
  }

  async createProject(input: CreateProjectRequest) {
    const project = await createRouteProject({
      rootDir: this.options.rootDir,
      title: input.topic,
      category: input.category,
      region: input.region,
      language: input.language ?? "en"
    });
    await appendProjectEvent(project.folderPath, {
      type: "project.created",
      message: `Project created: ${project.title}`,
      data: { status: project.status }
    });
    return project;
  }

  async listProjects(filters: ProjectListFilters = {}) {
    const projects = await listRouteProjects(this.options.rootDir);
    return filterProjects(projects, filters);
  }

  listCategories() {
    return listAtlasCategories();
  }

  listSourceProviders() {
    return getSearchProviderStatus();
  }

  async dashboard() {
    return buildDashboardSummary((await this.listProjects({ limit: 200 })).projects);
  }

  getProject(projectSlug: string) {
    return this.loadProject(projectSlug);
  }

  async collectSources(projectSlug: string, input: CollectSourcesRequest = {}) {
    const project = await this.loadProject(projectSlug);
    const sources = await collectSources({ project, provider: input.provider, limit: input.limit });
    await appendProjectEvent(project.folderPath, {
      type: "sources.collected",
      message: `Collected ${sources.length} sources.`,
      data: { sourceCount: sources.length }
    });
    return sources;
  }

  async runDeepResearch(projectSlug: string, input: RunDeepResearchRequest = {}) {
    const project = await this.loadProject(projectSlug);
    const report = await runDeepResearch({ project, sourceLimit: input.sourceLimit });
    await appendProjectEvent(project.folderPath, {
      type: "research.deep_completed",
      message: `Deep research processed ${report.processedSourceCount} sources.`,
      data: {
        processedSourceCount: report.processedSourceCount,
        failedSourceCount: report.failedSourceCount,
        addedClaimCount: report.addedClaimCount,
        candidatePoiCount: report.candidatePoiCount,
        mappedPoiCount: report.mappedPoiCount
      }
    });
    return report;
  }

  async writeBrief(projectSlug: string) {
    const { project, sources } = await this.loadProjectBundle(projectSlug);
    return generateResearchBrief({ project, sources });
  }

  async runMvp2(projectSlug: string) {
    return this.runMvp2WithProgress(projectSlug);
  }

  async runMvp2WithProgress(projectSlug: string, onProgress?: WorkflowProgressCallback) {
    let { project, sources } = await this.loadProjectBundle(projectSlug);
    const progress = async (message: string, value: number, currentStep: string) => {
      onProgress?.({ message, progress: value, currentStep });
      await appendProjectEvent(project.folderPath, {
        type: `workflow.${currentStep}`,
        message,
        data: { progress: value }
      });
    };

    await progress("Generating claims.", 10, "claims");
    await generateClaims(project, sources);
    await progress("Extracting POI.", 20, "pois");
    await extractPois(project);
    await progress("Writing route concept.", 35, "concept");
    const concept = await generateRouteConcept({ project, sources });
    await progress("Writing guide draft.", 50, "guide");
    await generateGuideDraft({ project, sources, concept });
    await progress("Generating tips.", 60, "tips");
    await generateRouteTips(project);
    await progress("Generating recommendations.", 68, "recommendations");
    await generateRecommendations(project);
    await progress("Preparing media pack.", 76, "media");
    await prepareMediaPack(project);
    await progress("Writing quality report.", 84, "quality");
    await generateQualityReport({ project, sources, gpxValid: false, geojsonValid: true });
    await progress("Writing review checklist.", 90, "review");
    await writeReviewChecklist(project);
    await progress("Preparing RouteMarket payload.", 96, "payload");
    await prepareRouteMarketDraft(project);
    project = await updateProjectStatus(project, "ready_for_review");
    await appendProjectEvent(project.folderPath, {
      type: "project.status_changed",
      message: "Project status changed to ready_for_review.",
      data: { status: project.status }
    });
    sources = await this.loadSources(project);
    onProgress?.({ message: "MVP 2 workflow completed.", progress: 100, currentStep: "completed" });
    return { project, sources };
  }

  async preparePublish(projectSlug: string) {
    const project = await this.loadProject(projectSlug);
    return prepareRouteMarketDraft(project);
  }

  async listArtifacts(projectSlug: string) {
    const project = await this.loadProject(projectSlug);
    return {
      project,
      artifacts: await listProjectArtifacts(project.folderPath)
    };
  }

  async getProjectBundle(projectSlug: string) {
    const project = await this.loadProject(projectSlug);
    const [artifacts, events] = await Promise.all([
      listProjectArtifacts(project.folderPath),
      listProjectEvents(project.folderPath)
    ]);
    return { project, artifacts, events };
  }

  async assessReadiness(projectSlug: string) {
    const project = await this.loadProject(projectSlug);
    const [artifacts, sources, claims] = await Promise.all([
      listProjectArtifacts(project.folderPath),
      this.loadSources(project),
      this.loadClaims(project)
    ]);
    return assessProjectReadiness({ project, artifacts, sources, claims });
  }

  async getReview(projectSlug: string) {
    const project = await this.loadProject(projectSlug);
    const [artifacts, sources, claims] = await Promise.all([
      listProjectArtifacts(project.folderPath),
      this.loadSources(project),
      this.loadClaims(project)
    ]);
    return buildProjectReviewBundle({ project, artifacts, sources, claims });
  }

  async submitReviewDecision(projectSlug: string, input: SubmitReviewDecisionRequest) {
    const project = await this.loadProject(projectSlug);
    return saveProjectReviewDecision({
      project,
      decision: input.decision,
      reviewer: input.reviewer,
      notes: input.notes
    });
  }

  async exportProject(projectSlug: string) {
    const { project, artifacts, events } = await this.getProjectBundle(projectSlug);
    return buildProjectExportBundle({ project, artifacts, events });
  }

  async archiveProject(projectSlug: string, reason?: string): Promise<RouteProject> {
    const updated = await this.setProjectStatus(projectSlug, "archived");
    await appendProjectEvent(updated.folderPath, {
      type: "project.archived",
      message: reason ? `Project archived: ${reason}` : "Project archived.",
      data: { reason }
    });
    return updated;
  }

  async listEvents(projectSlug: string) {
    const project = await this.loadProject(projectSlug);
    return {
      project,
      events: await listProjectEvents(project.folderPath)
    };
  }

  async readProjectFile(projectSlug: string, file: string): Promise<string> {
    if (!allowedProjectFiles.has(file) || file.includes("..") || file.startsWith("/") || file.startsWith("\\")) {
      throw new Error("Invalid file path.");
    }
    return readFile(join(routesPath(this.options.rootDir, projectSlug), file), "utf8");
  }

  async writeProjectFile(projectSlug: string, file: string, content: string): Promise<{ path: string; content: string }> {
    const project = await this.loadProject(projectSlug);
    if (!writableProjectFiles.has(file) || file.includes("..") || file.startsWith("/") || file.startsWith("\\")) {
      throw new Error("File is not writable through Atlas API.");
    }
    await writeFile(join(routesPath(this.options.rootDir, projectSlug), file), content, "utf8");
    await appendProjectEvent(project.folderPath, {
      type: "project.file_updated",
      message: `Updated ${file}.`,
      data: { path: file }
    });
    return { path: file, content };
  }

  async setProjectStatus(projectSlug: string, status: string): Promise<RouteProject> {
    const project = await this.loadProject(projectSlug);
    const updated = await updateProjectStatus(project, status);
    await appendProjectEvent(project.folderPath, {
      type: "project.status_changed",
      message: `Project status changed to ${status}.`,
      data: { status }
    });
    return updated;
  }

  private async loadProjectBundle(projectSlug: string): Promise<{ project: RouteProject; sources: Source[] }> {
    const project = await this.loadProject(projectSlug);
    const sources = await this.loadSources(project);
    return { project, sources };
  }

  private loadProject(projectSlug: string): Promise<RouteProject> {
    return readJsonFile<RouteProject>(join(routesPath(this.options.rootDir, projectSlug), "project.json"));
  }

  private loadSources(project: RouteProject): Promise<Source[]> {
    return readJsonFile<Source[]>(join(project.folderPath, "sources.json"));
  }

  private loadClaims(project: RouteProject): Promise<Claim[]> {
    return readJsonFile<Claim[]>(join(project.folderPath, "claims.json"));
  }
}

const allowedProjectFiles = new Set([
  "project.json",
  "brief.md",
  "sources.json",
  "claims.json",
  "notes.md",
  "poi.geojson",
  "route_concept.md",
  "guide.md",
  "tips.json",
  "recommendations.json",
  "quality_report.md",
  "review_checklist.md",
  "routemarket_payload.json",
  "review_decision.json",
  "deep_research.json",
  "research/deep/source_001.txt",
  "research/deep/source_002.txt",
  "research/deep/source_003.txt",
  "media/license_report.md",
  "media/manifest.json"
]);

const writableProjectFiles = new Set([
  "brief.md",
  "notes.md",
  "route_concept.md",
  "guide.md",
  "quality_report.md",
  "review_checklist.md",
  "media/license_report.md"
]);
