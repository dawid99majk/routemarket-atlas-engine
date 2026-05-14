import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  readJsonFile,
  type Claim,
  type Poi,
  type RouteProject,
  type RouteSummary,
  type Approvals,
  type MissingInputs,
  type MissingInputItem
} from "../../atlas-core/src/index.js";

export async function writeGuideOutline(project: RouteProject): Promise<string> {
  const outline = `# Outline for ${project.title}
1. Introduction
2. Key Highlights
3. Route Details
4. Preparation
5. Conclusion`;
  await writeFile(join(project.folderPath, "guide_outline.md"), outline, "utf8");
  return outline;
}

export async function generateGuideDraft(input: { project: RouteProject; sources?: any[]; concept?: string }): Promise<string> {
  // Legacy method for MVP1 compatibility
  const guide = `# ${input.project.title} (Draft)`;
  await writeFile(join(input.project.folderPath, "guide.md"), guide, "utf8");
  return guide;
}

export async function generateGuideV2(project: RouteProject): Promise<string | undefined> {
  const summary = await readRouteSummary(project);
  const pack = await readResearchPack(project);
  const claims = await readClaims(project);
  const pois = await readPois(project);
  const concept = await readConcept(project);
  const approvals = await readApprovals(project);

  // Validate inputs
  const missing: MissingInputItem[] = [];
  
  if (!summary) {
    missing.push({ code: "missing_route_summary", message: "route_summary.json is missing.", requiredFor: "guide_final" });
  } else {
    if (summary.distanceKm === undefined || summary.distanceKm <= 0) {
      missing.push({ code: "invalid_distance", message: "Route distance must be greater than 0.", requiredFor: "guide_final" });
    }
    if (summary.validationStatus === "needs_validation") {
      missing.push({ code: "needs_gpx_validation", message: "GPX summary needs human approval.", requiredFor: "guide_final" });
    }
  }
  
  if (!pack || pack.materials.length === 0) {
    missing.push({ code: "missing_research", message: "Research pack is missing or empty.", requiredFor: "guide_final" });
  }

  const verifiedClaims = claims.filter(c => c.status === "verified" || c.status === "likely");
  if (claims.length < 3 || verifiedClaims.length < 2) {
    missing.push({ code: "insufficient_claims", message: "At least 3 claims (min 2 verified/likely) required.", requiredFor: "guide_final" });
  }

  const outlineApproved = approvals?.approvals.some((a: any) => a.stage === "guide_outline_approval" && a.decision === "approved");
  if (!outlineApproved) {
    missing.push({ code: "missing_outline_approval", message: "Guide outline must be approved before final guide generation.", requiredFor: "guide_final" });
  }

  if (missing.length > 0) {
    const missingInputs: MissingInputs = {
      projectId: project.id,
      generatedAt: new Date().toISOString(),
      blocking: true,
      missing
    };
    await writeFile(join(project.folderPath, "missing_inputs.json"), JSON.stringify(missingInputs, null, 2), "utf8");
    console.warn(`Guide generation blocked by missing inputs for project ${project.id}`);
    return undefined;
  }

  // Clear missing inputs if fixed
  try {
    const { unlink } = await import("node:fs/promises");
    await unlink(join(project.folderPath, "missing_inputs.json"));
  } catch {}

  const guide = `# ${project.title}

## Quick facts
- Distance: ${summary!.distanceKm} km
- Elevation: ${summary!.elevationGainM} m
- Surface: ${summary!.surfaceType}

## Overview
${concept || "This route covers..."}

## Detailed Points
${pois.map(p => `### ${p.name}\n${p.description}`).join("\n\n")}

## Tips
${claims.filter(c => c.status === "verified").map(c => `- ${c.claim}`).join("\n")}
`;

  await writeFile(join(project.folderPath, "guide.md"), guide, "utf8");
  return guide;
}

// Helpers
async function readRouteSummary(project: RouteProject): Promise<RouteSummary | undefined> {
  try {
    return await readJsonFile<RouteSummary>(join(project.folderPath, "route_summary.json"));
  } catch {
    return undefined;
  }
}

async function readResearchPack(project: RouteProject): Promise<any> {
  try {
    return await readJsonFile<any>(join(project.folderPath, "research_pack.json"));
  } catch {
    return undefined;
  }
}

async function readClaims(project: RouteProject): Promise<Claim[]> {
  try {
    return await readJsonFile<Claim[]>(join(project.folderPath, "claims.json"));
  } catch {
    return [];
  }
}

async function readPois(project: RouteProject): Promise<Poi[]> {
  try {
    const geojson = await readJsonFile<any>(join(project.folderPath, "poi.geojson"));
    return geojson.features.map((f: any) => ({
      name: f.properties.name,
      description: f.properties.description
    }));
  } catch {
    return [];
  }
}

async function readConcept(project: RouteProject): Promise<string | undefined> {
  try {
    return await readFile(join(project.folderPath, "route_concept.md"), "utf8");
  } catch {
    return undefined;
  }
}

async function readApprovals(project: RouteProject): Promise<Approvals | undefined> {
  try {
    return await readJsonFile<Approvals>(join(project.folderPath, "approvals.json"));
  } catch {
    return undefined;
  }
}
