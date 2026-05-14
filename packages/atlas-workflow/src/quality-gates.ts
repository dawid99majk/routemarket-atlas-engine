import { join } from "node:path";
import { readFile, stat } from "node:fs/promises";
import type { RouteProject, Source, Claim, RouteSummary } from "../../atlas-core/src/index.js";
import { readJsonFile } from "../../atlas-core/src/index.js";

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
      const phrases = ["needs validation", "needs review", "not yet validated", "pending"];
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
  } catch (e) {
    issues.push({ rule: "claims_unreadable", message: "claims.json is missing or invalid." });
  }

  // 8: Route summary
  try {
    const summary = await readJsonFile<RouteSummary>(pPath("route_summary.json"));
    if (summary.validationStatus === "needs_validation") {
      issues.push({ rule: "summary_needs_validation", message: "route_summary.json status is marked as 'needs_validation'." });
    }
    // basic data check could go here if needed, but schema parsing in readJsonFile should ensure presence
  } catch (e) {
    issues.push({ rule: "missing_route_summary", message: "route_summary.json is missing or invalid." });
  }

  return issues;
}
