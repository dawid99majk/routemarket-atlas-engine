import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createRouteProject,
  addInputLink,
  addInputText,
  registerExternalInput,
  listRouteProjects,
  readJsonFile,
  readJsonFileWithSchema,
  RouteProjectSchema,
  SourceSchema,
  ClaimSchema,
  routesPath,
  updateProjectStatus,
  FileProjectStorage,
  type RouteProject,
  type Source,
  type Claim,
  type ProjectStorageAdapter
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
  storage?: ProjectStorageAdapter;
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
  private readonly storage: ProjectStorageAdapter;

  constructor(private readonly options: AtlasWorkflowOptions) {
    this.storage = options.storage ?? new FileProjectStorage(options.rootDir);
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
    const projects = await this.storage.listProjects();
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
    return this.storage.getProject(projectSlug);
  }

  async collectSources(projectSlug: string, input: CollectSourcesRequest = {}) {
    const project = await this.storage.getProject(projectSlug);
    const sources = await collectSources({ project, provider: input.provider, limit: input.limit });
    await appendProjectEvent(project.folderPath, {
      type: "sources.collected",
      message: `Collected ${sources.length} sources.`,
      data: { sourceCount: sources.length }
    });
    return sources;
  }

  async runDeepResearch(projectSlug: string, input: RunDeepResearchRequest = {}) {
    const project = await this.storage.getProject(projectSlug);
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

  async addNoteText(projectSlug: string, input: AddTextInputRequest) {
    const project = await this.storage.getProject(projectSlug);
    const item = await addInputText(project.folderPath, { ...input, type: "note" });
    await appendProjectEvent(project.folderPath, {
      type: "input.note_added",
      message: `Added note input: ${item.originalName}.`,
      data: { item }
    });
    return { project, item };
  }

  async addGpxText(projectSlug: string, input: AddTextInputRequest) {
    const project = await this.storage.getProject(projectSlug);
    const item = await addInputText(project.folderPath, { ...input, type: "gpx" });
    await appendProjectEvent(project.folderPath, {
      type: "input.gpx_added",
      message: `Added GPX input: ${item.originalName}.`,
      data: { item }
    });
    return { project, item };
  }

  async addLink(projectSlug: string, input: { url: string; note?: string }) {
    const project = await this.storage.getProject(projectSlug);
    const item = await addInputLink(project.folderPath, input.url, input.note);
    await appendProjectEvent(project.folderPath, {
      type: "input.link_added",
      message: `Added link input: ${input.url}.`,
      data: { item }
    });
    return { project, item };
  }

  async registerExternalInput(projectSlug: string, input: {
    type: import("../../atlas-core/src/index.js").InputItemType;
    originalName: string;
    storageUrl?: string;
    storageKey?: string;
    mimeType: string;
    sizeBytes: number;
    note?: string;
  }) {
    const project = await this.storage.getProject(projectSlug);
    const item = await registerExternalInput(project.folderPath, input);
    await appendProjectEvent(project.folderPath, {
      type: "input.external_registered",
      message: `Registered external input: ${item.originalName}.`,
      data: { item }
    });
    return { project, item };
  }

  async buildResearchPack(projectSlug: string) {
    const project = await this.storage.getProject(projectSlug);
    const { buildResearchPack } = await import("../../atlas-research/src/index.js");
    const researchPack = await buildResearchPack(project);
    await appendProjectEvent(project.folderPath, {
      type: "research.pack_built",
      message: `Built research pack with ${researchPack.materials.length} materials.`,
      data: { materialCount: researchPack.materials.length }
    });
    return { project, researchPack };
  }

  async analyzeGpx(projectSlug: string) {
    const project = await this.storage.getProject(projectSlug);
    const { analyzeGpx } = await import("../../atlas-research/src/index.js");
    const routeSummary = await analyzeGpx(project);
    await appendProjectEvent(project.folderPath, {
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
      await appendProjectEvent(project.folderPath, {
        type: `workflow.${currentStep}`,
        message,
        data: { progress: value, paused: !!waitContext }
      });
      await writeWorkflowState(project, {
        currentStep,
        waitingApprovalStage: waitContext?.stage,
        nextStep: waitContext?.stage ? nextStepAfterStage(waitContext.stage) : undefined
      });
    };

    const isApproved = async (stage: string) => {
      if (options.autoApprove && process.env.NODE_ENV !== "production") return true;
      try {
        const approvals = await this.storage.loadApprovals(projectSlug);
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
          await buildResearchPack(project);
        }
      },
      {
        id: "gpx",
        run: async () => {
          await progress("Analyzing GPX.", 10, "gpx");
          const { analyzeGpx } = await import("../../atlas-research/src/index.js");
          try {
            await analyzeGpx(project);
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
          await generateClaims(project);
          
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
          await extractPois(project);
          
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
          await generateRouteConcept({ project, sources });
          
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
          await writeGuideOutline(project);
          
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
          await generateGuideV2(project);
          
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
          await generateRouteTips(project);
          await generateRecommendations(project);
          await prepareMediaPack(project);
          await generateQualityReport({ project, sources, gpxValid: true, geojsonValid: true });
          await writeReviewChecklist(project);
          await prepareRouteMarketDraft(project);
          
          project = await updateProjectStatus(project, "draft_generated");
          await appendProjectEvent(project.folderPath, {
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
          const { exists } = await import("../../atlas-core/src/index.js");
          if (!await exists(join(project.folderPath, "research_pack.json"))) {
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
      const state = await readWorkflowState(project);
      await writeWorkflowState(project, {
        completedSteps: [...new Set([...state.completedSteps, steps[i].id])],
        currentStep: steps[i].id,
        waitingApprovalStage: undefined,
        nextStep: steps[i + 1]?.id
      });
    }

    onProgress?.({ message: "Workflow completed.", progress: 100, currentStep: "completed" });
    return { project, status: "completed" };
  }


  async preparePublish(projectSlug: string) {
    const project = await this.storage.getProject(projectSlug);
    const { checkQualityGates, QualityGateError } = await import("./quality-gates.js");
    const issues = await checkQualityGates(project);
    if (issues.length > 0) {
      throw new QualityGateError(issues);
    }
    return prepareRouteMarketDraft(project);
  }

  async listArtifacts(projectSlug: string) {
    const project = await this.storage.getProject(projectSlug);
    return {
      project,
      artifacts: await listProjectArtifacts(project.folderPath)
    };
  }

  async getProjectBundle(projectSlug: string) {
    const project = await this.storage.getProject(projectSlug);
    const [artifacts, events] = await Promise.all([
      listProjectArtifacts(project.folderPath),
      listProjectEvents(project.folderPath)
    ]);
    return { project, artifacts, events };
  }

  async assessReadiness(projectSlug: string) {
    const project = await this.storage.getProject(projectSlug);
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
    const project = await this.storage.getProject(projectSlug);
    const [artifacts, sources, claims] = await Promise.all([
      listProjectArtifacts(project.folderPath),
      this.loadSources(projectSlug),
      this.loadClaims(projectSlug)
    ]);
    const { checkQualityGates } = await import("./quality-gates.js");
    const qualityIssues = await checkQualityGates(project);
    return buildProjectReviewBundle({ project, storage: this.storage, artifacts, sources, claims, qualityIssues });
  }

  async submitReviewDecision(projectSlug: string, input: SubmitReviewDecisionRequest) {
    const project = await this.storage.getProject(projectSlug);
    return saveProjectReviewDecision({
      project,
      storage: this.storage,
      decision: input.decision,
      reviewer: input.reviewer,
      notes: input.notes
    });
  }

  async approveStage(projectSlug: string, stage: string, decision: import("./review.js").ApprovalDecision, notes?: string) {
    const project = await this.storage.getProject(projectSlug);
    const { saveProjectApprovalDecision } = await import("./review.js");
    const result = await saveProjectApprovalDecision({
      project,
      storage: this.storage,
      stage,
      decision,
      notes
    });
    await writeWorkflowState(project, { waitingApprovalStage: undefined, nextStep: nextStepAfterStage(stage) });
    return result;
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
    const project = await this.storage.getProject(projectSlug);
    return {
      project,
      events: await listProjectEvents(project.folderPath)
    };
  }

  async readProjectFile(projectSlug: string, file: string): Promise<string> {
    if (!allowedProjectFiles.has(file) || file.includes("..") || file.startsWith("/") || file.startsWith("\\")) {
      throw new Error("Invalid file path.");
    }
    return this.storage.readProjectFile(projectSlug, file);
  }

  async writeProjectFile(projectSlug: string, file: string, content: string): Promise<{ path: string; content: string }> {
    const project = await this.getProject(projectSlug);
    if (!writableProjectFiles.has(file) || file.includes("..") || file.startsWith("/") || file.startsWith("\\")) {
      throw new Error("File is not writable through Atlas API.");
    }
    await this.storage.writeProjectFile(projectSlug, file, content);
    await appendProjectEvent(project.folderPath, {
      type: "project.file_updated",
      message: `Updated ${file}.`,
      data: { path: file }
    });
    return { path: file, content };
  }

  async setProjectStatus(projectSlug: string, status: import("../../atlas-core/src/index.js").ProjectStatus): Promise<RouteProject> {
    const project = await this.getProject(projectSlug);
    const updated = await updateProjectStatus(project, status);
    await this.storage.saveProject(projectSlug, updated);
    await appendProjectEvent(project.folderPath, {
      type: "project.status_changed",
      message: `Project status changed to ${status}.`,
      data: { status }
    });
    return updated;
  }

  private async loadProjectBundle(projectSlug: string): Promise<{ project: RouteProject; sources: Source[] }> {
    const project = await this.getProject(projectSlug);
    const sources = await this.loadSources(projectSlug);
    return { project, sources };
  }

  private loadSources(projectSlug: string): Promise<Source[]> {
    return this.storage.loadSources(projectSlug);
  }

  private loadClaims(projectSlug: string): Promise<Claim[]> {
    return this.storage.loadClaims(projectSlug);
  }
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
