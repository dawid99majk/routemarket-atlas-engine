import { join } from "node:path";
import type { RouteProject } from "../../atlas-core/src/index.js";
import { readJsonFile } from "../../atlas-core/src/index.js";
import { findStaleApprovals, hashImportantArtifacts } from "./artifact-hashes.js";
import type { QualityIssue } from "./quality-gates.js";
import type { RouteMarketImportReadiness } from "../../atlas-publisher/src/types.js";

const requiredApprovalStages = [
  "gpx_summary_approval",
  "claims_approval",
  "poi_approval",
  "concept_approval",
  "guide_outline_approval",
  "guide_final_approval"
] as const;

export async function buildImportReadiness(input: {
  project: RouteProject;
  qualityIssues?: QualityIssue[];
  payloadPath?: string;
}): Promise<RouteMarketImportReadiness> {
  const payloadPath = input.payloadPath ?? join(input.project.folderPath, "routemarket_payload.json");
  const qualityIssues = input.qualityIssues ?? [];
  const approvals = await readApprovals(input.project);
  const artifactHashes = await hashImportantArtifacts(input.project);
  const staleApprovals = findStaleApprovals(approvals, artifactHashes).map((item) => item.stage);
  const missingApprovals = requiredApprovalStages.filter((stage) => {
    return !approvals.approvals.some((approval: any) => approval.stage === stage && approval.decision === "approved");
  });

  const blockingReasons = [
    ...qualityIssues.map((issue) => issue.message),
    ...missingApprovals.map((stage) => `Missing approval: ${stage}`),
    ...staleApprovals.map((stage) => `Stale approval: ${stage}`)
  ];

  const warnings = approvals.approvals
    .filter((approval: any) => approval.decision === "changes_requested")
    .map((approval: any) => `Changes requested at ${approval.stage}.`);

  const state = blockingReasons.length > 0
    ? "blocked_by_missing_inputs"
    : input.project.status === "draft_generated" || input.project.status === "approved_for_publish"
      ? "ready_to_import"
      : input.project.status === "changes_requested"
        ? "changes_requested"
        : input.project.status === "blocked"
          ? "failed"
          : input.project.status === "ready_for_review"
            ? "waiting_for_approval"
            : "collecting_inputs";

  return {
    state,
    canImportToRouteMarket: blockingReasons.length === 0,
    blockingReasons,
    warnings,
    missingApprovals,
    staleApprovals: [...new Set(staleApprovals)],
    payloadPath,
    recommendedNextAction: recommendNextAction({
      blockingReasons,
      missingApprovals,
      staleApprovals
    })
  };
}

async function readApprovals(project: RouteProject): Promise<any> {
  try {
    return await readJsonFile<any>(join(project.folderPath, "approvals.json"));
  } catch {
    return { projectId: project.id, approvals: [] };
  }
}

function recommendNextAction(input: {
  blockingReasons: string[];
  missingApprovals: string[];
  staleApprovals: string[];
}): string {
  if (input.missingApprovals.length > 0) {
    return `Approve next required stage: ${input.missingApprovals[0]}.`;
  }
  if (input.staleApprovals.length > 0) {
    return `Re-review stale stage: ${input.staleApprovals[0]}.`;
  }
  if (input.blockingReasons.length > 0) {
    return "Resolve blocking quality or missing input issues before import.";
  }
  return "Import Atlas payload into a RouteMarket draft.";
}
