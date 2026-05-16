import { join } from "node:path";
import { readFile, stat } from "node:fs/promises";
import type { RouteProject, Source, Claim, RouteSummary } from "../../atlas-core/src/index.js";
import { readJsonFile } from "../../atlas-core/src/index.js";
import { findStaleApprovals, hashImportantArtifacts } from "./artifact-hashes.js";

export type QualityIssue = {
  rule: string;
  message: string;
};

export class QualityGateError extends Error {
  constructor(public readonly issues: QualityIssue[]) {
    super("Quality Gate Failed");
    this.name = "QualityGateError";
  }
}

export async function checkQualityGates(project: RouteProject): Promise<QualityIssue[]> {
  const issues: QualityIssue[] = [];
  const pPath = (file: string) => join(project.folderPath, file);
  
  const fileExists = async (path: string) => {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  };

  // 1 & 2: Sources
  try {
    const sources = await readJsonFile<Source[]>(pPath("sources.json"));
    if (sources.length < 3) {
      issues.push({ rule: "min_sources", message: `Not enough sources: ${sources.length}/3.` });
    }
    const hasOfficialOrMap = sources.some(s => s.sourceType === "official" || s.sourceType === "map");
    if (!hasOfficialOrMap) {
      issues.push({ rule: "missing_trusted_source", message: "No source of type 'official' or 'map' found." });
    }
  } catch (e) {
    issues.push({ rule: "sources_unreadable", message: "sources.json is missing or invalid." });
  }

  // 3: POI 0,0
  try {
    if (await fileExists(pPath("poi.geojson"))) {
      const poiContent = await readFile(pPath("poi.geojson"), "utf8");
      const poiData = JSON.parse(poiContent);
      if (poiData.features) {
        const hasZeroZero = poiData.features.some((f: any) => {
          const coords = f.geometry?.coordinates;
          return coords && coords[0] === 0 && coords[1] === 0;
        });
        if (hasZeroZero) {
          issues.push({ rule: "invalid_poi_coordinates", message: "poi.geojson contains coordinates exactly 0,0." });
        }
      }
    }
  } catch (e) {
    issues.push({ rule: "poi_unreadable", message: "poi.geojson is invalid." });
  }

  // 4: Guide.md placeholders
  try {
    if (await fileExists(pPath("guide.md"))) {
      const guideContent = await readFile(pPath("guide.md"), "utf8");
      const lower = guideContent.toLowerCase();
      const phrases = [
        "needs validation",
        "needs review",
        "not yet validated",
        "pending",
        "todo",
        "to be confirmed",
        "unknown values",
        "this route covers...",
        "generic safety",
        "not available in mvp",
        "unknown",
        "tbd",
        "standard outdoor safety rules apply",
        "plan ahead for water stops",
        "based on collected research"
      ];
      for (const phrase of phrases) {
        if (lower.includes(phrase)) {
          issues.push({ rule: "placeholder_in_guide", message: `guide.md contains placeholder text: "${phrase}".` });
        }
      }
    } else {
      issues.push({ rule: "missing_guide", message: "guide.md is missing." });
    }
  } catch (e) {
    issues.push({ rule: "guide_unreadable", message: "guide.md could not be read." });
  }

  // 5: Quality report
  if (!(await fileExists(pPath("quality_report.md")))) {
    issues.push({ rule: "missing_quality_report", message: "quality_report.md is missing." });
  }

  // 6 & 7: Claims
  try {
    const claims = await readJsonFile<Claim[]>(pPath("claims.json"));
    if (claims.length < 3) {
      issues.push({ rule: "min_claims", message: `Not enough claims: ${claims.length}/3.` });
    }
      if (claims.length > 0 && claims.every(c => c.status === "uncertain")) {
        issues.push({ rule: "unverified_claims", message: "All claims have status 'uncertain'." });
      }
    if (!claims.some(c => c.status === "verified" || c.status === "likely")) {
      issues.push({ rule: "missing_verified_claims", message: "At least one verified or likely claim is required." });
    }
  } catch (e) {
    issues.push({ rule: "claims_unreadable", message: "claims.json is missing or invalid." });
  }

  // 8: Route summary
  try {
    const summary = await readJsonFile<RouteSummary>(pPath("route_summary.json"));
    if (summary.validationStatus === "needs_validation") {
      issues.push({ rule: "summary_needs_validation", message: "route_summary.json status is marked as 'needs_validation'." });
    }
    if (summary.validationStatus !== "validated") {
      issues.push({ rule: "summary_not_validated", message: "GPX route summary must be validated before publish preparation." });
    }
    if (!Array.isArray((summary as any).routeSegments) || (summary as any).routeSegments.length === 0) {
      issues.push({ rule: "missing_route_segments", message: "route_summary.json must include GPX-derived route segments." });
    }
    if (!Array.isArray((summary as any).warnings)) {
      issues.push({ rule: "missing_route_warnings", message: "route_summary.json must include GPX analysis warnings." });
    }
    // basic data check could go here if needed, but schema parsing in readJsonFile should ensure presence
  } catch (e) {
    issues.push({ rule: "missing_route_summary", message: "route_summary.json is missing or invalid." });
  }

  let hasGpxInput = false;
  if (await fileExists(pPath("route.gpx"))) hasGpxInput = true;
  try {
    if (await fileExists(pPath("input/manifest.json"))) {
      const manifest = await readJsonFile<any>(pPath("input/manifest.json"));
      if (manifest?.items?.some((i: any) => i.type === "gpx")) {
        hasGpxInput = true;
      }
    }
  } catch {}

  if (hasGpxInput && !(await fileExists(pPath("route_segments.geojson")))) {
    issues.push({ rule: "missing_route_segments_geojson", message: "route_segments.geojson is required when GPX exists." });
  }

  // 9: Missing Inputs
  if (await fileExists(pPath("missing_inputs.json"))) {
    try {
      const missing = await readJsonFile<any>(pPath("missing_inputs.json"));
      if (missing.blocking && missing.missing.length > 0) {
        issues.push({ rule: "blocking_missing_inputs", message: `Project has ${missing.missing.length} blocking missing inputs.` });
      }
    } catch {}
  }

  // 10: Approvals
  try {
    if (await fileExists(pPath("approvals.json"))) {
      const approvals = await readJsonFile<any>(pPath("approvals.json"));
      const required = ["gpx_summary_approval", "claims_approval", "poi_approval", "concept_approval", "guide_outline_approval", "guide_final_approval"];
      for (const r of required) {
        if (!approvals.approvals.some((a: any) => a.stage === r && a.decision === "approved")) {
          issues.push({ rule: `missing_approval_${r}`, message: `Required approval missing: ${r}` });
        }
      }
      const stale = findStaleApprovals(approvals, await hashImportantArtifacts(project));
      for (const item of stale) {
        issues.push({ rule: `stale_approval_${item.stage}`, message: `Approval ${item.stage} is stale because ${item.file} changed.` });
      }
    } else {
      issues.push({ rule: "missing_approvals_file", message: "approvals.json is missing." });
    }
  } catch {}

  try {
    const description = await readFile(pPath("guide.md"), "utf8");
    if (description.trim().length < 500) {
      issues.push({ rule: "description_too_short", message: "Payload description/guide is too short for RouteMarket publish preparation." });
    }
  } catch {}

  return issues;
}
