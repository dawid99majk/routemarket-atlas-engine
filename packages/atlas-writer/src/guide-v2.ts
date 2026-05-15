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
  const guide = `# ${input.project.title} (Draft)

## Route overview

This is an internal draft shell for ${input.project.category} route planning in ${input.project.region}. It is not a final RouteMarket guide.

## Source coverage

Current source count: ${input.sources?.length ?? 0}
`;
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
  
  if (!pack || pack.materials.filter((m: any) => m.status === "active" || m.status === "usable").length === 0) {
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

  if (!concept || isWeakConcept(concept)) {
    missing.push({ code: "missing_route_concept", message: "A real route concept is required before final guide generation.", requiredFor: "guide_final" });
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

  const warnings = summary!.warnings ?? [];
  const segments = summary!.routeSegments ?? [];
  const trustedMaterials = pack!.materials.filter((m: any) => m.status === "active" || m.status === "usable");
  const guide = `# ${project.title}

## Quick facts
- Distance: ${summary!.distanceKm} km
- Elevation gain: ${summary!.elevationGainM ?? "not provided in GPX"} m
- Estimated time: ${summary!.estimatedTimeH} h
- Difficulty: ${summary!.difficulty ?? "requires editor classification"}
- Loop type: ${summary!.loopType ?? "not classified"}
- Start: ${summary!.startPoint}
- Finish: ${summary!.endPoint}

## Target audience

${targetAudience(project.category)}

## Route value

${extractConceptSection(concept!, "Route promise")}

## Route overview

This guide is based on validated GPX facts, creator materials and reviewed route claims. The route covers ${summary!.distanceKm} km in ${project.region}, with ${summary!.isLoop ? "a loop format" : "a point-to-point format"}.

## Segment description

${segments.length ? segments.map(segment => `### Segment ${segment.index}: ${segment.from} to ${segment.to}

- Distance: ${segment.distanceKm} km
- Elevation gain: ${segment.elevationGainM ?? 0} m
- Estimated time: ${segment.estimatedTimeH ?? "category estimate included in total"} h`).join("\n\n") : "- Segment data is not available."}

## Points of interest

${pois.length ? pois.map(p => `### ${p.name}\n\n${p.description ?? "Approved point of interest on the route."}`).join("\n\n") : "- No approved POI have been attached yet."}

## Logistics

${claimsByType(claims, ["logistics", "distance", "access"])}

## Safety

${claimsByType(claims, ["safety", "legal"])}

## Season notes

${claimsByType(claims, ["season"])}

## Preparation

- Download the GPX before departure.
- Check weather, road or trail closures, and local access rules before starting.
- Carry backup navigation and enough water, food, fuel or battery for the route category.

## Variants

- Shorten the route at a verified settlement, trailhead or road junction before committing to remote sections.
- Extend only after validating extra GPX distance, surface and daylight.

## Sources

${trustedMaterials.map((material: any) => `- ${material.title}${material.sourceUrl ? ` (${material.sourceUrl})` : ""}`).join("\n")}

## Warnings and validation notes

${warnings.length ? warnings.map((warning: any) => `- ${warning.message}`).join("\n") : "- No GPX warnings were produced during analysis."}

## Disclaimer

This guide is an editorial navigation aid, not a guarantee of access, safety, weather, legality or current field conditions. Verify critical facts before publishing and before travel.
`;

  await writeFile(join(project.folderPath, "guide.md"), guide, "utf8");
  return guide;
}

function isWeakConcept(concept: string): boolean {
  const lower = concept.toLowerCase();
  return concept.trim().length < 250 || lower.includes("concept status: not designed") || lower.includes("to be confirmed");
}

function targetAudience(category: string): string {
  const audiences: Record<string, string> = {
    motorcycle: "Adventure motorcyclists who need route shape, surface risk, fuel awareness and offline navigation confidence.",
    hiking: "Independent hikers who need realistic timing, terrain notes, water planning and safety context.",
    cycling: "Cyclists who need distance, elevation, surface expectations and reliable logistics.",
    city_walk: "Self-guided walkers who want a coherent route with worthwhile stops and simple navigation.",
    roadtrip: "Drivers who want scenic flow, practical stops and realistic time planning."
  };
  return audiences[category] ?? "Travelers who need a practical, verified route guide.";
}

function extractConceptSection(concept: string, heading: string): string {
  const lines = concept.split(/\r?\n/);
  const index = lines.findIndex((line) => line.trim().toLowerCase() === `## ${heading}`.toLowerCase());
  if (index === -1) return "The route value is described in the approved route concept.";
  const collected: string[] = [];
  for (const line of lines.slice(index + 1)) {
    if (line.startsWith("## ")) break;
    if (line.trim()) collected.push(line.trim());
  }
  return collected.join(" ") || "The route value is described in the approved route concept.";
}

function claimsByType(claims: Claim[], types: Claim["claimType"][]): string {
  const selected = claims.filter((claim) => (claim.status === "verified" || claim.status === "likely") && types.includes(claim.claimType));
  return selected.length ? selected.map((claim) => `- ${claim.claim}`).join("\n") : "- No reviewed facts in this category yet.";
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
