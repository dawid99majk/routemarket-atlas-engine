import { join } from "node:path";
import {
  readJsonFile,
  readJsonFileWithSchema,
  RouteProjectSchema,
  SourceSchema,
  ClaimSchema,
  routesPath,
  updateProjectStatus,
  FileProjectRepository,
  type RouteProject,
  type Source,
  type Claim,
  type ProjectRepository,
  type InputItemType
} from "../../atlas-core/src/index.js";
import { z } from "zod";
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
import { buildImportReadiness } from "./import-readiness.js";
import { buildProjectReviewBundle, saveProjectReviewDecision, type ReviewDecision } from "./review.js";
import { readWorkflowState, writeWorkflowState } from "./workflow-state.js";

export type AtlasWorkflowOptions = {
  rootDir: string;
  repository?: ProjectRepository;
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

export type AddTextInputRequest = {
  fileName: string;
  content: string;
  note?: string;
};

export type WorkflowProgress = {
  message: string;
  progress?: number;
  currentStep?: string;
};

export type WorkflowProgressCallback = (progress: WorkflowProgress) => void;

export class AtlasWorkflowService {
  private readonly repository: ProjectRepository;

  constructor(private readonly options: AtlasWorkflowOptions) {
    this.repository = options.repository ?? new FileProjectRepository(options.rootDir);
  }

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
    const project = await this.repository.createProject({
      title: input.topic,
      category: input.category,
      region: input.region,
      language: input.language ?? "en"
    });
    await appendProjectEvent(project.id, this.repository, {
      type: "project.created",
      message: `Project created: ${project.title}`,
      data: { status: project.status }
    });
    return project;
  }

  async listProjects(filters: ProjectListFilters = {}) {
    const projects = await this.repository.listProjects();
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
    return this.repository.getProject(projectSlug);
  }

  async collectSources(projectSlug: string, input: CollectSourcesRequest = {}) {
    const project = await this.repository.getProject(projectSlug);
    const sources = await collectSources({ project, provider: input.provider, limit: input.limit, repository: this.repository });
    await appendProjectEvent(project.id, this.repository, {
      type: "sources.collected",
      message: `Collected ${sources.length} sources.`,
      data: { sourceCount: sources.length }
    });
    return sources;
  }

  async runDeepResearch(projectSlug: string, input: RunDeepResearchRequest = {}) {
    const project = await this.repository.getProject(projectSlug);
    const report = await runDeepResearch({ project, sourceLimit: input.sourceLimit, repository: this.repository });
    await appendProjectEvent(project.id, this.repository, {
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
    return generateResearchBrief({ project, sources, repository: this.repository });
  }

  async runMvp2(projectSlug: string) {
    return this.runMvp2WithProgress(projectSlug);
  }

  async addNoteText(projectSlug: string, input: AddTextInputRequest) {
    const project = await this.repository.getProject(projectSlug);
    const item = await this.addTextInputThroughRepository(project.id, { ...input, type: "note" });
    await appendProjectEvent(project.id, this.repository, {
      type: "input.note_added",
      message: `Added note input: ${item.originalName}.`,
      data: { item }
    });
    return { project, item };
  }

  async addGpxText(projectSlug: string, input: AddTextInputRequest) {
    const project = await this.repository.getProject(projectSlug);
    const item = await this.addTextInputThroughRepository(project.id, { ...input, type: "gpx" });
    await appendProjectEvent(project.id, this.repository, {
      type: "input.gpx_added",
      message: `Added GPX input: ${item.originalName}.`,
      data: { item }
    });
    return { project, item };
  }

  async addLink(projectSlug: string, input: { url: string; note?: string }) {
    const project = await this.repository.getProject(projectSlug);
    const manifest = await this.repository.loadInputManifest(project.id);
    const now = new Date().toISOString();
    const item = {
      id: `link_${Date.now()}`,
      type: "link" as const,
      path: input.url,
      originalName: input.url,
      mimeType: "text/uri-list",
      sizeBytes: 0,
      addedAt: now,
      status: "added" as const,
      notes: input.note
    };
    manifest.items.push(item);
    manifest.updatedAt = now;
    await this.repository.saveInputManifest(project.id, manifest);
    await appendProjectEvent(project.id, this.repository, {
      type: "input.link_added",
      message: `Added link input: ${input.url}.`,
      data: { item }
    });
    return { project, item };
  }

  async registerExternalInput(projectSlug: string, input: {
    type: InputItemType;
    originalName: string;
    storageUrl?: string;
    storageKey?: string;
    mimeType: string;
    sizeBytes: number;
    note?: string;
  }) {
    const project = await this.repository.getProject(projectSlug);
    if (!input.storageUrl && !input.storageKey) throw new Error("storageUrl or storageKey is required.");
    const manifest = await this.repository.loadInputManifest(project.id);
    const now = new Date().toISOString();
    const fileName = safeInputName(input.originalName);
    const item = {
      id: `${input.type}_${Date.now()}`,
      type: input.type,
      path: input.storageKey ?? input.storageUrl ?? fileName,
      originalName: fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      storageUrl: input.storageUrl,
      storageKey: input.storageKey,
      addedAt: now,
      status: externalInputStatus(input.type, fileName, input.mimeType),
      notes: input.note
    };
    manifest.items.push(item);
    manifest.updatedAt = now;
    await this.repository.saveInputManifest(project.id, manifest);
    await appendProjectEvent(project.id, this.repository, {
      type: "input.external_registered",
      message: `Registered external input: ${item.originalName}.`,
      data: { item }
    });
    return { project, item };
  }

  private async addTextInputThroughRepository(projectSlug: string, input: AddTextInputRequest & { type: "note" | "gpx" }) {
    const fileName = safeInputName(input.fileName);
    const isGpx = input.type === "gpx";
    if (isGpx && !fileName.toLowerCase().endsWith(".gpx")) throw new Error("Only .gpx files are allowed.");
    if (!isGpx && !(fileName.toLowerCase().endsWith(".md") || fileName.toLowerCase().endsWith(".txt"))) {
      throw new Error("Only .md and .txt files are allowed.");
    }

    const maxSize = isGpx ? 10_000_000 : 2_000_000;
    const sizeBytes = Buffer.byteLength(input.content, "utf8");
    if (sizeBytes > maxSize) throw new Error(`Input is too large. Max size is ${maxSize} bytes.`);

    const manifest = await this.repository.loadInputManifest(projectSlug);
    const now = new Date().toISOString();
    const targetPath = `input/${isGpx ? "gpx" : "notes"}/${fileName}`;
    await this.repository.writeProjectFile(projectSlug, targetPath, input.content);

    if (isGpx) {
      await this.repository.writeProjectFile(projectSlug, "route.gpx", input.content);
    }

    const item = {
      id: `${input.type}_${Date.now()}`,
      type: input.type,
      path: targetPath,
      originalName: fileName,
      mimeType: mimeTypeForFile(fileName),
      sizeBytes,
      addedAt: now,
      status: "added" as const,
      notes: input.note
    };
    manifest.items.push(item);
    manifest.updatedAt = now;
    await this.repository.saveInputManifest(projectSlug, manifest);
    return item;
  }

  async buildResearchPack(projectSlug: string) {
    const project = await this.repository.getProject(projectSlug);
    const { buildResearchPack } = await import("../../atlas-research/src/index.js");
    const researchPack = await buildResearchPack(project, this.repository);
    await appendProjectEvent(project.id, this.repository, {
      type: "research.pack_built",
      message: `Built research pack with ${researchPack.materials.length} materials.`,
      data: { materialCount: researchPack.materials.length }
    });
    return { project, researchPack };
  }

  async analyzeGpx(projectSlug: string) {
    const project = await this.repository.getProject(projectSlug);
    const { analyzeGpx } = await import("../../atlas-research/src/index.js");
    const routeSummary = await analyzeGpx(project, this.repository);
    await appendProjectEvent(project.id, this.repository, {
      type: "gpx.analyzed",
      message: `Analyzed GPX route: ${routeSummary.distanceKm ?? 0} km.`,
      data: { routeSummary }
    });
    return { project, routeSummary };
  }

  async runMvp2WithProgress(projectSlug: string, onProgress?: WorkflowProgressCallback, startStep?: string, options: { autoApprove?: boolean } = {}) {
    let { project, sources } = await this.loadProjectBundle(projectSlug);
    const progress = async (message: string, value: number, currentStep: string, waitContext?: any) => {
      onProgress?.({ message, progress: value, currentStep, waitContext } as any);
      await appendProjectEvent(project.id, this.repository, {
        type: `workflow.${currentStep}`,
        message,
        data: { progress: value, paused: !!waitContext }
      });
      await writeWorkflowState(project, {
        currentStep,
        waitingApprovalStage: waitContext?.stage,
        nextStep: waitContext?.stage ? nextStepAfterStage(waitContext.stage) : undefined
      }, this.repository);
    };

    const isApproved = async (stage: string) => {
      if (options.autoApprove && process.env.NODE_ENV !== "production") return true;
      try {
        const approvals = await this.repository.loadApprovals(projectSlug);
        return approvals.approvals.some((a: any) => a.stage === stage && a.decision === "approved");
      } catch {
        return false;
      }
    };

    const steps = [
      {
        id: "input",
        run: async () => {
          await progress("Processing input materials.", 5, "input");
          const { buildResearchPack } = await import("../../atlas-research/src/index.js");
          await buildResearchPack(project, this.repository);
        }
      },
      {
        id: "gpx",
        run: async () => {
          await progress("Analyzing GPX.", 10, "gpx");
          const { analyzeGpx } = await import("../../atlas-research/src/index.js");
          try {
            await analyzeGpx(project, this.repository);
          } catch (err) {
            console.warn("GPX analysis failed or file missing, continuing...");
          }
          
          if (!await isApproved("gpx_summary_approval")) {
            await progress("GPX analyzed. Waiting for summary approval.", 15, "gpx_summary_approval", {
              type: "approval_needed",
              stage: "gpx_summary_approval"
            });
            return { pause: true, stage: "gpx_summary_approval" };
          }
        }
      },
      {
        id: "claims",
        run: async () => {
          await progress("Generating claims.", 25, "claims");
          await generateClaims(project, this.repository);
          
          if (!await isApproved("claims_approval")) {
            await progress("Claims generated. Waiting for approval.", 30, "claims_approval", {
              type: "approval_needed",
              stage: "claims_approval"
            });
            return { pause: true, stage: "claims_approval" };
          }
        }
      },
      {
        id: "pois",
        run: async () => {
          await progress("Extracting POI.", 40, "pois");
          await extractPois(project, this.repository);
          
          if (!await isApproved("poi_approval")) {
            await progress("POI extracted. Waiting for verification.", 45, "poi_approval", {
              type: "approval_needed",
              stage: "poi_approval"
            });
            return { pause: true, stage: "poi_approval" };
          }
        }
      },
      {
        id: "concept",
        run: async () => {
          await progress("Writing route concept.", 55, "concept");
          await generateRouteConcept({ project, sources, repository: this.repository });
          
          if (!await isApproved("concept_approval")) {
            await progress("Concept generated. Waiting for approval.", 60, "concept_approval", {
              type: "approval_needed",
              stage: "concept_approval"
            });
            return { pause: true, stage: "concept_approval" };
          }
        }
      },
      {
        id: "guide_outline",
        run: async () => {
          await progress("Generating guide outline.", 70, "guide_outline");
          const { writeGuideOutline } = await import("../../atlas-writer/src/index.js");
          await writeGuideOutline(project, this.repository);
          
          if (!await isApproved("guide_outline_approval")) {
            await progress("Outline generated. Waiting for approval.", 75, "guide_outline_approval", {
              type: "approval_needed",
              stage: "guide_outline_approval"
            });
            return { pause: true, stage: "guide_outline_approval" };
          }
        }
      },
      {
        id: "guide",
        run: async () => {
          await progress("Writing final guide.", 80, "guide");
          const { generateGuideV2 } = await import("../../atlas-writer/src/index.js");
          await generateGuideV2(project, this.repository);
          
          if (!await isApproved("guide_final_approval")) {
            await progress("Guide written. Waiting for final approval.", 85, "guide_final_approval", {
              type: "approval_needed",
              stage: "guide_final_approval"
            });
            return { pause: true, stage: "guide_final_approval" };
          }
        }
      },
      {
        id: "finalize",
        run: async () => {
          await progress("Finalizing artifacts.", 90, "finalize");
          await generateRouteTips(project, this.repository);
          await generateRecommendations(project, this.repository);
          await prepareMediaPack(project, this.repository);
          await generateQualityReport({ project, sources, gpxValid: true, geojsonValid: true, repository: this.repository });
          await writeReviewChecklist(project, this.repository);
          await prepareRouteMarketDraft(project);
          
          project = await updateProjectStatus(project, "draft_generated");
          await appendProjectEvent(project.id, this.repository, {
            type: "project.status_changed",
            message: "Project status changed to draft_generated.",
            data: { status: "draft_generated" }
          });
        }
      }
    ];

    let currentStepId = startStep;
    if (!currentStepId) {
      // Find the first step that isn't approved or missing artifacts
      for (const step of steps) {
        if (step.id === "input") {
          if (!await this.repository.exists(project.id, "research_pack.json")) {
            currentStepId = "input";
            break;
          }
          continue;
        }

        const stage = getStageForStep(step.id);
        if (stage && !await isApproved(stage)) {
          currentStepId = step.id;
          break;
        }
      }
      if (!currentStepId) currentStepId = "input"; // Fallback to start
    }

    let startIndex = steps.findIndex(s => s.id === currentStepId);
    if (startIndex === -1) startIndex = 0;

    for (let i = startIndex; i < steps.length; i++) {
      const result = await steps[i].run() as any;
      if (result?.pause) return { project, status: "paused", step: steps[i].id, stage: result.stage };
      const state = await readWorkflowState(project, this.repository);
      await writeWorkflowState(project, {
        completedSteps: [...new Set([...state.completedSteps, steps[i].id])],
        currentStep: steps[i].id,
        waitingApprovalStage: undefined,
        nextStep: steps[i + 1]?.id
      }, this.repository);
    }

    onProgress?.({ message: "Workflow completed.", progress: 100, currentStep: "completed" });
    return { project, status: "completed" };
  }


  async preparePublish(projectSlug: string) {
    const project = await this.repository.getProject(projectSlug);
    const { checkQualityGates, QualityGateError } = await import("./quality-gates.js");
    const issues = await checkQualityGates(project);
    if (issues.length > 0) {
      throw new QualityGateError(issues);
    }
    return prepareRouteMarketDraft(project);
  }

  async listArtifacts(projectSlug: string) {
    const project = await this.repository.getProject(projectSlug);
    return {
      project,
      artifacts: await listProjectArtifacts(project.folderPath)
    };
  }

  async getProjectBundle(projectSlug: string) {
    const project = await this.repository.getProject(projectSlug);
    const [artifacts, events] = await Promise.all([
      listProjectArtifacts(project.folderPath),
      listProjectEvents(project.id, this.repository)
    ]);
    return { project, artifacts, events };
  }

  async assessReadiness(projectSlug: string) {
    const project = await this.repository.getProject(projectSlug);
    const [artifacts, sources, claims] = await Promise.all([
      listProjectArtifacts(project.folderPath),
      this.loadSources(projectSlug),
      this.loadClaims(projectSlug)
    ]);
    
    const { checkQualityGates } = await import("./quality-gates.js");
    const qualityIssues = await checkQualityGates(project);
    
    const readiness = assessProjectReadiness({ project, artifacts, sources, claims, qualityIssues });
    readiness.importReadiness = await buildImportReadiness({ project, qualityIssues });
    return readiness;
  }

  async getReview(projectSlug: string) {
    const project = await this.repository.getProject(projectSlug);
    const [artifacts, sources, claims] = await Promise.all([
      listProjectArtifacts(project.folderPath),
      this.loadSources(projectSlug),
      this.loadClaims(projectSlug)
    ]);
    const { checkQualityGates } = await import("./quality-gates.js");
    const qualityIssues = await checkQualityGates(project);
    return buildProjectReviewBundle({ project, repository: this.repository, artifacts, sources, claims, qualityIssues });
  }

  async submitReviewDecision(projectSlug: string, input: SubmitReviewDecisionRequest) {
    const project = await this.repository.getProject(projectSlug);
    return saveProjectReviewDecision({
      project,
      repository: this.repository,
      decision: input.decision,
      reviewer: input.reviewer,
      notes: input.notes
    });
  }

  async approveStage(projectSlug: string, stage: string, decision: import("./review.js").ApprovalDecision, notes?: string, reviewer?: string) {
    const project = await this.repository.getProject(projectSlug);
    const { saveProjectApprovalDecision } = await import("./review.js");
    const result = await saveProjectApprovalDecision({
      project,
      repository: this.repository,
      stage,
      decision,
      reviewer,
      notes
    });
    await writeWorkflowState(project, { waitingApprovalStage: undefined, nextStep: nextStepAfterStage(stage) }, this.repository);
    return result;
  }

  async exportProject(projectSlug: string) {
    const { project, artifacts, events } = await this.getProjectBundle(projectSlug);
    return buildProjectExportBundle({ project, artifacts, events });
  }

  async archiveProject(projectSlug: string, reason?: string): Promise<RouteProject> {
    const updated = await this.setProjectStatus(projectSlug, "archived");
    await appendProjectEvent(updated.id, this.repository, {
      type: "project.archived",
      message: reason ? `Project archived: ${reason}` : "Project archived.",
      data: { reason }
    });
    return updated;
  }

  async listEvents(projectSlug: string) {
    const project = await this.repository.getProject(projectSlug);
    return {
      project,
      events: await listProjectEvents(project.id, this.repository)
    };
  }

  async readProjectFile(projectSlug: string, file: string): Promise<string> {
    if (!allowedProjectFiles.has(file) || file.includes("..") || file.startsWith("/") || file.startsWith("\\")) {
      throw new Error("Invalid file path.");
    }
    return this.repository.readProjectFile(projectSlug, file);
  }

  async writeProjectFile(projectSlug: string, file: string, content: string): Promise<{ path: string; content: string }> {
    const project = await this.getProject(projectSlug);
    if (!writableProjectFiles.has(file) || file.includes("..") || file.startsWith("/") || file.startsWith("\\")) {
      throw new Error("File is not writable through Atlas API.");
    }
    await this.repository.writeProjectFile(projectSlug, file, content);
    await appendProjectEvent(project.id, this.repository, {
      type: "project.file_updated",
      message: `Updated ${file}.`,
      data: { path: file }
    });
    return { path: file, content };
  }

  async setProjectStatus(projectSlug: string, status: import("../../atlas-core/src/index.js").ProjectStatus): Promise<RouteProject> {
    const project = await this.getProject(projectSlug);
    const updated = await updateProjectStatus(project, status);
    await this.repository.saveProject(updated);
    await appendProjectEvent(project.id, this.repository, {
      type: "project.status_changed",
      message: `Project status changed to ${status}.`,
      data: { status }
    });
    return updated;
  }

  private async loadProjectBundle(projectSlug: string): Promise<{ project: RouteProject; sources: Source[] }> {
    const project = await this.repository.getProject(projectSlug);
    const sources = await this.loadSources(projectSlug);
    return { project, sources };
  }

  private loadSources(projectSlug: string): Promise<Source[]> {
    return this.repository.loadSources(projectSlug);
  }

  private loadClaims(projectSlug: string): Promise<Claim[]> {
    return this.repository.loadClaims(projectSlug);
  }
}


function safeInputName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop()?.replace(/[^a-zA-Z0-9._-]/g, "_") ?? "";
  if (!base || base === "." || base === ".." || base.startsWith(".") || base.includes("..")) {
    throw new Error("Invalid filename.");
  }
  if (base !== fileName || fileName.includes("/") || fileName.includes("\\")) {
    throw new Error("Invalid filename.");
  }
  return base;
}

function mimeTypeForFile(fileName: string): string {
  const lowered = fileName.toLowerCase();
  if (lowered.endsWith(".md")) return "text/markdown";
  if (lowered.endsWith(".txt")) return "text/plain";
  if (lowered.endsWith(".gpx")) return "application/gpx+xml";
  if (lowered.endsWith(".jpg") || lowered.endsWith(".jpeg")) return "image/jpeg";
  if (lowered.endsWith(".png")) return "image/png";
  if (lowered.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

function externalInputStatus(type: InputItemType, fileName: string, mimeType: string) {
  const lowered = fileName.toLowerCase();
  if (type === "note" && (lowered.endsWith(".md") || lowered.endsWith(".txt"))) return "needs_parser" as const;
  if (type === "gpx" && lowered.endsWith(".gpx")) return "needs_parser" as const;
  if (type === "photo" && mimeType.startsWith("image/")) return "needs_review" as const;
  if (type === "document" && (lowered.endsWith(".pdf") || lowered.endsWith(".docx"))) return "needs_parser" as const;
  return "unsupported" as const;
}

const allowedProjectFiles = new Set([
  "project.json",
  "brief.md",
  "sources.json",
  "claims.json",
  "notes.md",
  "poi.geojson",
  "approvals.json",
  "route_concept.md",
  "guide.md",
  "tips.json",
  "recommendations.json",
  "quality_report.md",
  "review_checklist.md",
  "routemarket_payload.json",
  "review_decision.json",
  "deep_research.json",
  "research_pack.json",
  "route_summary.json",
  "route_segments.json",
  "route_warnings.json",
  "route_segments.geojson",
  "workflow_state.json",
  "input_manifest.json",
  "elevation_profile.json",
  "research/deep/source_001.txt",
  "research/deep/source_002.txt",
  "research/deep/source_003.txt",
  "media/license_report.md",
  "media/manifest.json",
  "missing_inputs.json"
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

function getStageForStep(stepId: string): string | undefined {
  const map: Record<string, string> = {
    gpx: "gpx_summary_approval",
    claims: "claims_approval",
    pois: "poi_approval",
    concept: "concept_approval",
    guide_outline: "guide_outline_approval",
    guide: "guide_final_approval",
    finalize: "media_approval"
  };
  return map[stepId];
}

function nextStepAfterStage(stage: string): string | undefined {
  const nextStepMap: Record<string, string> = {
    gpx_summary_approval: "claims",
    claims_approval: "pois",
    poi_approval: "concept",
    concept_approval: "guide_outline",
    guide_outline_approval: "guide",
    guide_final_approval: "finalize"
  };
  return nextStepMap[stage];
}
