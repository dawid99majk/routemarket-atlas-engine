import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { RouteProject } from "../../atlas-core/src/index.js";

export const approvalArtifactMap: Record<string, string[]> = {
  gpx_summary_approval: ["route_summary.json", "route_segments.json", "route_segments.geojson", "route_warnings.json"],
  claims_approval: ["claims.json"],
  poi_approval: ["poi.geojson", "poi_candidates.json"],
  concept_approval: ["route_concept.md"],
  guide_outline_approval: ["guide_outline.md"],
  guide_final_approval: ["guide.md"]
};

export async function hashProjectArtifacts(project: RouteProject, files: string[]): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  for (const file of files) {
    try {
      const content = await readFile(join(project.folderPath, file), "utf8");
      hashes[file] = createHash("sha256").update(canonicalContent(file, content)).digest("hex");
    } catch {
      hashes[file] = "missing";
    }
  }
  return hashes;
}

function canonicalContent(file: string, content: string): string {
  if (file !== "claims.json") return content;
  try {
    const claims = JSON.parse(content);
    return JSON.stringify(claims.map((claim: any) => {
      const { usedInSections, ...rest } = claim;
      return rest;
    }));
  } catch {
    return content;
  }
}

export async function hashImportantArtifacts(project: RouteProject): Promise<Record<string, string>> {
  const files = [...new Set(Object.values(approvalArtifactMap).flat())];
  return hashProjectArtifacts(project, files);
}

export function findStaleApprovals(approvals: any, currentHashes: Record<string, string>): Array<{ stage: string; file: string }> {
  const stale: Array<{ stage: string; file: string }> = [];
  for (const approval of approvals?.approvals ?? []) {
    if (approval.decision !== "approved" || !approval.artifactHashes) continue;
    for (const [file, hash] of Object.entries(approval.artifactHashes)) {
      if (currentHashes[file] !== hash) stale.push({ stage: approval.stage, file });
    }
  }
  return stale;
}
