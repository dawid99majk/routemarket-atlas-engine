import { join } from "node:path";
import { readJsonFile, updateProjectStatus, writeJsonFile, type Claim, type RouteProject, type Source } from "../../atlas-core/src/index.js";
import type { ProjectArtifact } from "./artifacts.js";
import { appendProjectEvent, listProjectEvents, type ProjectEvent } from "./events.js";
import { assessProjectReadiness, type ReadinessReport } from "./readiness.js";

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
};

export async function buildProjectReviewBundle(input: {
  project: RouteProject;
  artifacts: ProjectArtifact[];
  sources: Source[];
  claims: Claim[];
}): Promise<ProjectReviewBundle> {
  const readiness = assessProjectReadiness(input);
  const events = await listProjectEvents(input.project.folderPath);

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
    recentEvents: events.slice(-10).reverse()
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
  const approvals = await readJsonFile<any>(path);
  
  const record = {
    stage: input.stage,
    decision: input.decision,
    reviewer: input.reviewer ?? "human",
    notes: input.notes,
    decidedAt: new Date().toISOString()
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

  await appendProjectEvent(input.project.folderPath, {
    type: "review.approval",
    message: `Approval for ${input.stage}: ${input.decision}.`,
    data: record
  });
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
