import type { Claim, RouteProject, Source } from "../../atlas-core/src/index.js";
import type { ProjectArtifact } from "./artifacts.js";
import type { RouteMarketImportReadiness } from "../../atlas-publisher/src/types.js";

export type ReadinessStatus = "ready" | "needs_review" | "blocked";

export type ReadinessCheck = {
  id: string;
  label: string;
  passed: boolean;
  severity: "info" | "warning" | "blocking";
  message: string;
};

export type ReadinessReport = {
  project: RouteProject;
  status: ReadinessStatus;
  score: number;
  checks: ReadinessCheck[];
  blockingCount: number;
  warningCount: number;
  importReadiness?: RouteMarketImportReadiness;
};

export function assessProjectReadiness(input: {
  project: RouteProject;
  artifacts: ProjectArtifact[];
  sources: Source[];
  claims: Claim[];
  qualityIssues?: import("./quality-gates.js").QualityIssue[];
}): ReadinessReport {
  const artifactExists = (path: string) => input.artifacts.some((artifact) => artifact.path === path && artifact.exists);
  const guide = input.artifacts.find((artifact) => artifact.path === "guide.md");
  const routePayload = artifactExists("routemarket_payload.json");

  const checks: ReadinessCheck[] = [
    check("sources-minimum", "At least 3 sources", input.sources.length >= 3, "blocking", `Source count: ${input.sources.length}`),
    check("official-source", "Official/local source present", input.sources.some((source) => source.sourceType === "official"), "warning", "Add an official/local source before publishing."),
    check("claims-generated", "Claims generated", input.claims.length > 0, "warning", `Claim count: ${input.claims.length}`),
    check("guide-present", "Guide draft present", Boolean(guide?.exists && (guide.sizeBytes ?? 0) > 200), "blocking", "Guide draft is missing or too short."),
    check("quality-report", "Quality report present", artifactExists("quality_report.md"), "blocking", "Quality report is required."),
    check("review-checklist", "Review checklist present", artifactExists("review_checklist.md"), "warning", "Review checklist should be present."),
    check("deep-research", "Deep research completed", artifactExists("deep_research.json"), "info", "Run deep research to enrich source intelligence."),
    check("payload-prepared", "RouteMarket payload prepared", routePayload, "warning", "Prepare payload before handoff."),
    check("status-ready", "Project is ready for review", input.project.status === "ready_for_review", "warning", `Current status: ${input.project.status}`),
    ...(input.qualityIssues || []).map(issue => check(`quality-${issue.rule}`, `Quality: ${issue.rule}`, false, "blocking", issue.message))
  ];

  const blockingCount = checks.filter((item) => !item.passed && item.severity === "blocking").length;
  const warningCount = checks.filter((item) => !item.passed && item.severity === "warning").length;
  const passedCount = checks.filter((item) => item.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);
  const status: ReadinessStatus = blockingCount > 0 ? "blocked" : warningCount > 0 ? "needs_review" : "ready";

  return {
    project: input.project,
    status,
    score,
    checks,
    blockingCount,
    warningCount
  };
}

function check(
  id: string,
  label: string,
  passed: boolean,
  severity: ReadinessCheck["severity"],
  message: string
): ReadinessCheck {
  return { id, label, passed, severity, message };
}
