import { join } from "node:path";
import { 
  updateProjectStatus, 
  type Claim, 
  type RouteProject, 
  type Source,
  type ProjectStorageAdapter
} from "../../atlas-core/src/index.js";
import type { ProjectArtifact } from "./artifacts.js";
import { appendProjectEvent, listProjectEvents, type ProjectEvent } from "./events.js";
import { assessProjectReadiness, type ReadinessReport } from "./readiness.js";
import { approvalArtifactMap, hashImportantArtifacts } from "./artifact-hashes.js";
import { readWorkflowState, type WorkflowState } from "./workflow-state.js";
import { buildImportReadiness } from "./import-readiness.js";

export type ReviewDecision = "approved" | "changes_requested" | "blocked";
export type ApprovalDecision = "approved" | "changes_requested" | "rejected";

export type ProjectReviewDecision = {
  decision: ReviewDecision;
  reviewer?: string;
  notes?: string;
  decidedAt: string;
};

export type ProjectReviewBundle = {
  project: RouteProject;
  readiness: ReadinessReport;
  sourceSummary: {
    total: number;
    byType: Record<string, number>;
    officialCount: number;
    averageTrustScore: number;
  };
  claimSummary: {
    total: number;
    needsReview: number;
  };
  artifactSummary: {
    requiredPresent: string[];
    requiredMissing: string[];
    optionalPresent: string[];
  };
  recommendedDecision: ReviewDecision;
  latestDecision?: ProjectReviewDecision;
  recentEvents: ProjectEvent[];
  approvals: any;
  workflowState: WorkflowState;
  missingInputs: any;
  artifactHashes: Record<string, string>;
  qualityIssues: import("./quality-gates.js").QualityIssue[];
  nextAction: {
    type: "approve_stage" | "fix_blocking_inputs" | "prepare_publish" | "review" | "none";
    label: string;
    stage?: string;
    blockingReason?: string;
  };
  importReadiness: import("../../atlas-publisher/src/types.js").RouteMarketImportReadiness;
};

export async function buildProjectReviewBundle(input: {
  project: RouteProject;
  storage: ProjectStorageAdapter;
  artifacts: ProjectArtifact[];
  sources: Source[];
  claims: Claim[];
  qualityIssues?: import("./quality-gates.js").QualityIssue[];
}): Promise<ProjectReviewBundle> {
  const readiness = assessProjectReadiness(input);
  const events = await listProjectEvents(input.project.folderPath);
  const approvals = await input.storage.loadApprovals(input.project.id);
  const missingInputs = await input.storage.loadMissingInputs(input.project.id);
  const qualityIssues = input.qualityIssues ?? [];
  const importReadiness = await buildImportReadiness({
    project: input.project,
    qualityIssues
  });

  readiness.importReadiness = importReadiness;

  let recommendedDecision: ReviewDecision = "approved";
  if (readiness.blockingCount > 0) recommendedDecision = "blocked";
  else if (readiness.warningCount > 0) recommendedDecision = "changes_requested";

  return {
    project: input.project,
    readiness,
    sourceSummary: summarizeSources(input.sources),
    claimSummary: summarizeClaims(input.claims),
    artifactSummary: summarizeArtifacts(input.artifacts),
    recommendedDecision,
    latestDecision: await readLatestReviewDecision(input.project.id, input.storage),
    recentEvents: events.slice(-10).reverse(),
    approvals,
    workflowState: await readWorkflowState(input.project),
    missingInputs,
    artifactHashes: await hashImportantArtifacts(input.project),
    qualityIssues,
    nextAction: nextAction(readiness, approvals, missingInputs, qualityIssues),
    importReadiness
  };
}

export async function saveProjectReviewDecision(input: {
  project: RouteProject;
  storage: ProjectStorageAdapter;
  decision: ReviewDecision;
  reviewer?: string;
  notes?: string;
}): Promise<{ project: RouteProject; review: ProjectReviewDecision }> {
  const review: ProjectReviewDecision = {
    decision: input.decision,
    reviewer: input.reviewer,
    notes: input.notes,
    decidedAt: new Date().toISOString()
  };
  await input.storage.saveReviewDecision(input.project.id, review);

  const status = statusForDecision(input.decision);
  const project = await updateProjectStatus(input.project, status);
  await input.storage.saveProject(input.project.id, project);
  await appendProjectEvent(project.folderPath, {
    type: "review.decision",
    message: `Review decision: ${input.decision}.`,
    data: {
      decision: input.decision,
      reviewer: input.reviewer,
      notes: input.notes,
      status
    }
  });

  return { project, review };
}

export async function saveProjectApprovalDecision(input: {
  project: RouteProject;
  storage: ProjectStorageAdapter;
  stage: string;
  decision: ApprovalDecision;
  reviewer?: string;
  notes?: string;
}): Promise<void> {
  let approvals = await input.storage.loadApprovals(input.project.id);
  
  const artifactHashes = await hashImportantArtifacts(input.project);
  const record: any = {
    stage: input.stage,
    decision: input.decision,
    reviewer: input.reviewer ?? "human",
    notes: input.notes,
    decidedAt: new Date().toISOString(),
    artifactHashes: filterHashesForStage(input.stage, artifactHashes),
    audit: {}
  };

  // Replace existing approval for this stage if it exists
  const index = approvals.approvals.findIndex((a: any) => a.stage === input.stage);
  if (index !== -1) {
    approvals.approvals[index] = record;
  } else {
    approvals.approvals.push(record);
  }

  approvals.updatedAt = record.decidedAt;
  await input.storage.saveApprovals(input.project.id, approvals);

  // Side effects for hardening
  if (input.decision === "approved") {
    if (input.stage === "gpx_summary_approval") {
      try {
        const summary = await input.storage.loadSummary(input.project.id);
        if (summary) {
          summary.validationStatus = "validated";
          await input.storage.saveSummary(input.project.id, summary);
        }
      } catch {}
    } else if (input.stage === "poi_approval") {
      let changedPoi = 0;
      try {
        const candidateData = JSON.parse(await input.storage.readProjectFile(input.project.id, "poi_candidates.json"));
        if (candidateData && Array.isArray(candidateData.pois)) {
          for (const candidate of candidateData.pois) {
            if (typeof candidate.lat === "number" && typeof candidate.lng === "number" && (candidate.lat !== 0 || candidate.lng !== 0)) {
              candidate.approvalStatus = "approved";
              changedPoi += 1;
            }
          }
          await input.storage.writeProjectFile(input.project.id, "poi_candidates.json", JSON.stringify(candidateData, null, 2));
        }
      } catch {}

      try {
        const geojson = JSON.parse(await input.storage.readProjectFile(input.project.id, "poi.geojson"));
        if (geojson && Array.isArray(geojson.features)) {
          for (const feature of geojson.features) {
            if (feature.geometry?.coordinates?.length === 2) {
              feature.properties = feature.properties || {};
              feature.properties.approvalStatus = "approved";
              changedPoi += 1;
            }
          }
          await input.storage.writeProjectFile(input.project.id, "poi.geojson", JSON.stringify(geojson, null, 2));
        }
      } catch {}
      record.audit.changedPoi = changedPoi;
    } else if (input.stage === "claims_approval") {
      try {
        const claims = await input.storage.loadClaims(input.project.id);
        const pack = JSON.parse(await input.storage.readProjectFile(input.project.id, "research_pack.json"));
        
        let creatorSourceIds = new Set<string>();
        if (pack && Array.isArray(pack.materials)) {
          for (const mat of pack.materials) {
            if (mat.trustLevel === "creator") {
              creatorSourceIds.add(mat.id);
            }
          }
        }

        let verifiedClaims = 0;
        let likelyClaims = 0;
        let unchangedClaims = 0;
        for (const claim of claims) {
          const isFromCreator = Array.isArray(claim.sources) && claim.sources.some((s: string) => creatorSourceIds.has(s) || s.startsWith("mat_note") || s.startsWith("mat_document") || s.includes("note"));
          
          if (claim.status === "needs_creator_review" && isFromCreator) {
            claim.status = "verified";
            claim.needsHumanReview = false;
            verifiedClaims += 1;
          } else if (claim.status === "uncertain" && (claim.sources?.length ?? 0) >= 2) {
            claim.status = "likely";
            claim.needsHumanReview = true;
            likelyClaims += 1;
          } else {
            unchangedClaims += 1;
          }
        }
        await input.storage.saveClaims(input.project.id, claims);
        record.audit.changedClaims = verifiedClaims + likelyClaims;
        record.audit.verifiedClaims = verifiedClaims;
        record.audit.likelyClaims = likelyClaims;
        record.audit.unchangedClaims = unchangedClaims;
      } catch {}
    }
  }

  record.artifactHashes = filterHashesForStage(input.stage, await hashImportantArtifacts(input.project));
  approvals.updatedAt = new Date().toISOString();
  await input.storage.saveApprovals(input.project.id, approvals);

  await appendProjectEvent(input.project.folderPath, {
    type: "review.approval",
    message: `Approval for ${input.stage}: ${input.decision}.`,
    data: record
  });
}

export async function readLatestReviewDecision(slug: string, storage: ProjectStorageAdapter): Promise<ProjectReviewDecision | undefined> {
  return storage.loadReviewDecision(slug);
}

function hasCreatorSource(claim: any): boolean {
  return Array.isArray(claim.sources) && claim.sources.some((source: string) => source.startsWith("mat_note") || source.startsWith("mat_document") || source.includes("note"));
}

function filterHashesForStage(stage: string, hashes: Record<string, string>): Record<string, string> {
  const files = approvalArtifactMap[stage] ?? [];
  return Object.fromEntries(files.map((file) => [file, hashes[file] ?? "missing"]));
}

function nextAction(readiness: ReadinessReport, approvals: any, missingInputs: any, qualityIssues: import("./quality-gates.js").QualityIssue[]): ProjectReviewBundle["nextAction"] {
  if (missingInputs?.blocking) return { type: "fix_blocking_inputs", label: "Fix missing inputs", blockingReason: missingInputs.missing?.[0]?.message };
  const stages = ["gpx_summary_approval", "claims_approval", "poi_approval", "concept_approval", "guide_outline_approval", "guide_final_approval"];
  const missingStage = stages.find((stage) => !approvals?.approvals?.some((approval: any) => approval.stage === stage && approval.decision === "approved"));
  if (missingStage) return { type: "approve_stage", label: `Approve ${missingStage}`, stage: missingStage };
  if (qualityIssues.length > 0 || readiness.blockingCount > 0) return { type: "fix_blocking_inputs", label: "Resolve quality gates", blockingReason: qualityIssues[0]?.message };
  if (readiness.status !== "ready") return { type: "review", label: "Review project warnings" };
  return { type: "prepare_publish", label: "Prepare RouteMarket draft" };
}

function summarizeSources(sources: Source[]): ProjectReviewBundle["sourceSummary"] {
  const byType: Record<string, number> = {};
  for (const source of sources) {
    byType[source.sourceType] = (byType[source.sourceType] ?? 0) + 1;
  }
  const averageTrustScore = sources.length
    ? Math.round(sources.reduce((sum, source) => sum + source.trustScore, 0) / sources.length)
    : 0;

  return {
    total: sources.length,
    byType,
    officialCount: byType.official ?? 0,
    averageTrustScore
  };
}

function summarizeClaims(claims: Claim[]): ProjectReviewBundle["claimSummary"] {
  return {
    total: claims.length,
    needsReview: claims.filter((claim) => !["confirmed", "likely"].includes(claim.status)).length
  };
}

function summarizeArtifacts(artifacts: ProjectArtifact[]): ProjectReviewBundle["artifactSummary"] {
  const required = ["sources.json", "claims.json", "guide.md", "quality_report.md", "review_checklist.md", "routemarket_payload.json"];
  const optional = ["deep_research.json", "route.gpx", "route.geojson"];
  const exists = (path: string) => artifacts.some((artifact) => artifact.path === path && artifact.exists);
  return {
    requiredPresent: required.filter(exists),
    requiredMissing: required.filter((path) => !exists(path)),
    optionalPresent: optional.filter(exists)
  };
}

import type { ProjectStatus } from "../../atlas-core/src/index.js";

function statusForDecision(decision: ReviewDecision): ProjectStatus {
  if (decision === "approved") return "approved_for_publish";
  if (decision === "changes_requested") return "changes_requested";
  return "blocked";
}

function reviewPath(project: RouteProject): string {
  // Deprecated, use storage
  return join(project.folderPath, "review_decision.json");
}
