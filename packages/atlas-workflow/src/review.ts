import { join } from "node:path";
import { readJsonFile, updateProjectStatus, writeJsonFile, type Claim, type RouteProject, type Source } from "../../atlas-core/src/index.js";
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
  artifacts: ProjectArtifact[];
  sources: Source[];
  claims: Claim[];
  qualityIssues?: import("./quality-gates.js").QualityIssue[];
}): Promise<ProjectReviewBundle> {
  const readiness = assessProjectReadiness(input);
  const events = await listProjectEvents(input.project.folderPath);
  const approvals = await readApprovals(input.project);
  const missingInputs = await readMissingInputs(input.project);
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
    latestDecision: await readLatestReviewDecision(input.project),
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
  await writeJsonFile(reviewPath(input.project), review);

  const status = statusForDecision(input.decision);
  const project = await updateProjectStatus(input.project, status);
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
  stage: string;
  decision: ApprovalDecision;
  reviewer?: string;
  notes?: string;
}): Promise<void> {
  const path = join(input.project.folderPath, "approvals.json");
  let approvals;
  try {
    approvals = await readJsonFile<any>(path);
  } catch {
    approvals = { projectId: input.project.id, updatedAt: "", approvals: [] };
  }
  
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
  await writeJsonFile(path, approvals);

  // Side effects for hardening
  if (input.decision === "approved") {
    if (input.stage === "gpx_summary_approval") {
      const summaryPath = join(input.project.folderPath, "route_summary.json");
      try {
        const summary = await readJsonFile<any>(summaryPath);
        summary.validationStatus = "validated";
        await writeJsonFile(summaryPath, summary);
      } catch {}
    } else if (input.stage === "poi_approval") {
      let changedPoi = 0;
      const poiPath = join(input.project.folderPath, "poi.geojson");
      try {
        const geojson = await readJsonFile<any>(poiPath);
        for (const feature of geojson.features) {
          if (feature.properties.status === "suggested") {
            feature.properties.status = "confirmed";
            changedPoi += 1;
          }
        }
        await writeJsonFile(poiPath, geojson);
      } catch {}
      const candidatePath = join(input.project.folderPath, "poi_candidates.json");
      try {
        const candidates = await readJsonFile<any[]>(candidatePath);
        for (const candidate of candidates) {
          if (candidate.status === "suggested") {
            candidate.status = "confirmed";
            changedPoi += 1;
          }
        }
        await writeJsonFile(candidatePath, candidates);
      } catch {}
      record.audit.changedPoi = changedPoi;
    } else if (input.stage === "claims_approval") {
      const claimsPath = join(input.project.folderPath, "claims.json");
      try {
        const claims = await readJsonFile<any[]>(claimsPath);
        let verifiedClaims = 0;
        let likelyClaims = 0;
        let unchangedClaims = 0;
        for (const claim of claims) {
          if (claim.status === "needs_creator_review" && hasCreatorSource(claim)) {
            claim.status = "verified";
            claim.needsHumanReview = false;
            verifiedClaims += 1;
          } else if (claim.status === "uncertain" && (claim.sources?.length ?? 0) > 1) {
            claim.status = "likely";
            claim.needsHumanReview = true;
            likelyClaims += 1;
          } else {
            unchangedClaims += 1;
          }
        }
        await writeJsonFile(claimsPath, claims);
        record.audit.changedClaims = verifiedClaims + likelyClaims;
        record.audit.verifiedClaims = verifiedClaims;
        record.audit.likelyClaims = likelyClaims;
        record.audit.unchangedClaims = unchangedClaims;
      } catch {}
    }
  }

  record.artifactHashes = filterHashesForStage(input.stage, await hashImportantArtifacts(input.project));
  approvals.updatedAt = new Date().toISOString();
  await writeJsonFile(path, approvals);

  await appendProjectEvent(input.project.folderPath, {
    type: "review.approval",
    message: `Approval for ${input.stage}: ${input.decision}.`,
    data: record
  });
}

function hasCreatorSource(claim: any): boolean {
  return Array.isArray(claim.sources) && claim.sources.some((source: string) => source.startsWith("mat_note") || source.startsWith("mat_document") || source.includes("note"));
}

function filterHashesForStage(stage: string, hashes: Record<string, string>): Record<string, string> {
  const files = approvalArtifactMap[stage] ?? [];
  return Object.fromEntries(files.map((file) => [file, hashes[file] ?? "missing"]));
}

async function readApprovals(project: RouteProject): Promise<any> {
  try {
    return await readJsonFile<any>(join(project.folderPath, "approvals.json"));
  } catch {
    return { projectId: project.id, approvals: [] };
  }
}

async function readMissingInputs(project: RouteProject): Promise<any> {
  try {
    return await readJsonFile<any>(join(project.folderPath, "missing_inputs.json"));
  } catch {
    return { missing: [] };
  }
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

export async function readLatestReviewDecision(project: RouteProject): Promise<ProjectReviewDecision | undefined> {
  try {
    return await readJsonFile<ProjectReviewDecision>(reviewPath(project));
  } catch {
    return undefined;
  }
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
  return join(project.folderPath, "review_decision.json");
}
