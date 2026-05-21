import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type Claim,
  type Poi,
  type RouteProject,
  type RouteSummary,
  type Approvals,
  type MissingInputs,
  type MissingInputItem,
  type ProjectRepository
} from "../../atlas-core/src/index.js";

export async function writeGuideOutline(project: RouteProject, repository?: ProjectRepository): Promise<string> {
  const outline = `# Outline for ${project.title}
1. Introduction
2. Key Highlights
3. Route Details
4. Preparation
5. Conclusion`;
  if (repository) {
    await repository.writeProjectFile(project.id, "guide_outline.md", outline);
  } else {
    await writeFile(join(project.folderPath, "guide_outline.md"), outline, "utf8");
  }
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

export async function validateGuideInputs(project: RouteProject, repository?: ProjectRepository): Promise<MissingInputs | undefined> {
  const summary = await readRouteSummary(project, repository);
  const pack = await readResearchPack(project, repository);
  const claims = await readClaims(project, repository);
  const concept = await readConcept(project, repository);
  const approvals = await readApprovals(project, repository);
  
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

  if (!pack || !pack.materials || pack.materials.length === 0) {
    missing.push({ code: "missing_research", message: "Research pack requires at least 1 material.", requiredFor: "guide_final" });
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
  missing.push(...missingMandatorySectionFacts(project.category, verifiedClaims));

  if (missing.length > 0) {
    return {
      projectId: project.id,
      generatedAt: new Date().toISOString(),
      blocking: true,
      missing
    };
  }
  return undefined;
}

export async function generateGuideV2(project: RouteProject, repository?: ProjectRepository): Promise<string | undefined> {
  const missingInputs = await validateGuideInputs(project, repository);

  if (missingInputs) {
    if (repository) {
      await repository.saveMissingInputs(project.id, missingInputs);
    } else {
      await writeFile(join(project.folderPath, "missing_inputs.json"), JSON.stringify(missingInputs, null, 2), "utf8");
    }
    console.warn(`Guide generation blocked by missing inputs for project ${project.id}`);
    return undefined;
  }

  // Clear missing inputs if fixed
  try {
    if (repository) {
      await repository.saveMissingInputs(project.id, { missing: [] });
    } else {
      const { unlink } = await import("node:fs/promises");
      await unlink(join(project.folderPath, "missing_inputs.json"));
    }
  } catch {}

  const summary = (await readRouteSummary(project, repository))!;
  const pack = (await readResearchPack(project, repository))!;
  const claims = await readClaims(project, repository);
  const pois = await readPois(project, repository);
  const concept = await readConcept(project, repository);

  const warnings = summary.warnings ?? [];
  const segments = summary.routeSegments ?? [];
  const trustedMaterials = pack.materials.filter((m: any) => m.status === "active" || m.status === "usable");
  
  const sectionClaims = {
    logistics: claimsForTypes(claims, ["logistics", "distance", "access"]),
    safety: claimsForTypes(claims, ["safety", "legal"]),
    season: claimsForTypes(claims, ["season"]),
    practical: claimsForTypes(claims, ["surface", "logistics", "access"])
  };
  markUsed(sectionClaims.logistics, "logistics");
  markUsed(sectionClaims.safety, "safety");
  markUsed(sectionClaims.season, "season_notes");
  markUsed(sectionClaims.practical, "preparation");
  
  if (repository) {
    await repository.saveClaims(project.id, claims);
  } else {
    const { writeJsonFile } = await import("../../atlas-core/src/index.js");
    await writeJsonFile(join(project.folderPath, "claims.json"), claims);
  }

  const quickFacts = [
    `Distance: ${summary.distanceKm} km`,
    summary.elevationGainM !== undefined ? `Elevation gain: ${summary.elevationGainM} m` : null,
    summary.estimatedTimeH !== undefined ? `Estimated time: ${summary.estimatedTimeH} h` : null,
    summary.difficulty ? `Difficulty: ${summary.difficulty}` : null,
    summary.loopType ? `Loop type: ${summary.loopType}` : null,
    summary.startPoint ? `Start: ${summary.startPoint}` : null,
    summary.endPoint ? `Finish: ${summary.endPoint}` : null
  ].filter(Boolean).map(f => `- ${f}`).join("\n");

  const segmentsText = segments.length ? segments.map(segment => {
    const sFacts = [
      `Distance: ${segment.distanceKm} km`,
      segment.elevationGainM !== undefined ? `Elevation gain: ${segment.elevationGainM} m` : null,
      segment.estimatedTimeH !== undefined ? `Estimated time: ${segment.estimatedTimeH} h` : null
    ].filter(Boolean).map(f => `- ${f}`).join("\n");
    return `### Segment ${segment.index}: ${segment.from} to ${segment.to}\n\n${sFacts}`;
  }).join("\n\n") : "";

  const poisText = pois.length ? pois.map(p => `### ${p.name}\n\n${p.description || ""}`).join("\n\n") : "";
  const warningsText = warnings.length ? warnings.map((warning: any) => `- ${warning.message}`).join("\n") : "";
  const routeValue = extractConceptSection(concept!, "Route promise");
  const audience = targetAudience(project.category);

  const guideBlocks = [
    `# ${project.title}`,
    `## Quick facts\n${quickFacts}`,
    audience ? `## Target audience\n\n${audience}` : null,
    routeValue ? `## Route value\n\n${routeValue}` : null,
    `## Route overview\n\nThis guide is based on validated GPX facts, creator materials and reviewed route claims. The route covers ${summary.distanceKm} km in ${project.region}, with ${summary.isLoop ? "a loop format" : "a point-to-point format"}.`,
    segmentsText ? `## Segment description\n\n${segmentsText}` : null,
    poisText ? `## Points of interest\n\n${poisText}` : null,
    sectionClaims.logistics.length ? `## Logistics\n\n${renderClaims(sectionClaims.logistics)}` : null,
    sectionClaims.safety.length ? `## Safety\n\n${renderClaims(sectionClaims.safety)}` : null,
    sectionClaims.season.length ? `## Season notes\n\n${renderClaims(sectionClaims.season)}` : null,
    `## Preparation\n\n- Download the GPX before departure.\n- Check weather, road or trail closures, and local access rules before starting.\n- Carry backup navigation and enough water, food, fuel or battery for the route category.`,
    `## Variants\n\n- Shorten the route at a verified settlement, trailhead or road junction before committing to remote sections.\n- Extend only after validating extra GPX distance, surface and daylight.`,
    trustedMaterials.length ? `## Sources\n\n${trustedMaterials.map((material: any) => `- ${material.title}${material.sourceUrl ? ` (${material.sourceUrl})` : ""}`).join("\n")}` : null,
    claims.some(c => c.usedInSections?.length) ? `## Sources and verification\n\n${claims.filter(c => c.usedInSections?.length).map(c => `- ${c.claim} [${c.sources.join(", ")}] used in ${c.usedInSections!.join(", ")}`).join("\n")}` : null,
    `## Review summary\n\n${reviewSummary(sectionClaims)}`,
    warningsText ? `## Warnings and validation notes\n\n${warningsText}` : null,
    `## Disclaimer\n\nThis guide is an editorial navigation aid, not a guarantee of access, safety, weather, legality or current field conditions. Verify critical facts before publishing and before travel.`
  ].filter(Boolean).join("\n\n");

  const guide = guideBlocks + "\n";

  if (repository) {
    await repository.writeProjectFile(project.id, "guide.md", guide);
  } else {
    await writeFile(join(project.folderPath, "guide.md"), guide, "utf8");
  }
  return guide;
}

function isWeakConcept(concept: string): boolean {
  const lower = concept.toLowerCase();
  return concept.trim().length < 250 || lower.includes("concept status: not designed") || lower.includes("to be confirmed");
}

function missingMandatorySectionFacts(category: string, claims: Claim[]): MissingInputItem[] {
  const missing: MissingInputItem[] = [];
  const has = (types: Claim["claimType"][]) => claims.some((claim) => types.includes(claim.claimType));
  if (category === "motorcycle") {
    if (!has(["logistics", "distance", "access"])) missing.push({ code: "missing_motorcycle_logistics", message: "Motorcycle guide requires reviewed logistics facts.", requiredFor: "guide_final" });
    if (!has(["safety", "legal"])) missing.push({ code: "missing_motorcycle_safety", message: "Motorcycle guide requires reviewed safety facts.", requiredFor: "guide_final" });
    if (!has(["surface", "logistics", "access"])) missing.push({ code: "missing_motorcycle_practical_claim", message: "Motorcycle guide requires at least one practical route claim.", requiredFor: "guide_final" });
  }
  if (category === "hiking" || category === "trekking") {
    if (!has(["safety"])) missing.push({ code: "missing_hiking_safety", message: "Hiking guide requires reviewed safety facts.", requiredFor: "guide_final" });
    if (!has(["season"])) missing.push({ code: "missing_hiking_weather", message: "Hiking guide requires reviewed season/weather facts.", requiredFor: "guide_final" });
    if (!has(["logistics", "access"])) missing.push({ code: "missing_hiking_logistics", message: "Hiking guide requires reviewed water, gear or logistics facts.", requiredFor: "guide_final" });
  }
  return missing;
}

function targetAudience(category: string): string {
  const audiences: Record<string, string> = {
    motorcycle: "Adventure motorcyclists who need route shape, surface risk, fuel awareness and offline navigation confidence.",
    hiking: "Independent hikers who need realistic timing, terrain notes, water planning and safety context.",
    cycling: "Cyclists who need distance, elevation, surface expectations and reliable logistics.",
    city_walk: "Self-guided walkers who want a coherent route with worthwhile stops and simple navigation.",
    roadtrip: "Drivers who want scenic flow, practical stops and realistic time planning."
  };
  return audiences[category] ?? "";
}

function extractConceptSection(concept: string, heading: string): string {
  const lines = concept.split(/\r?\n/);
  const index = lines.findIndex((line) => line.trim().toLowerCase() === `## ${heading}`.toLowerCase());
  if (index === -1) return "";
  const collected: string[] = [];
  for (const line of lines.slice(index + 1)) {
    if (line.startsWith("## ")) break;
    if (line.trim()) collected.push(line.trim());
  }
  return collected.join(" ");
}

function claimsForTypes(claims: Claim[], types: Claim["claimType"][]): Claim[] {
  return claims.filter((claim) => (claim.status === "verified" || claim.status === "likely") && types.includes(claim.claimType));
}

function renderClaims(claims: Claim[]): string {
  return claims.map((claim) => `- ${claim.claim}`).join("\n");
}

function markUsed(claims: Claim[], section: string): void {
  for (const claim of claims) {
    claim.usedInSections = [...new Set([...(claim.usedInSections ?? []), section])];
  }
}

function reviewSummary(sectionClaims: Record<string, Claim[]>): string {
  return Object.entries(sectionClaims)
    .filter(([_, claims]) => claims.length > 0)
    .map(([section, claims]) => `- ${section}: ${claims.length} supporting claim(s)`)
    .join("\n");
}

// Helpers
async function readRouteSummary(project: RouteProject, repository?: ProjectRepository): Promise<RouteSummary | undefined> {
  try {
    if (repository) return await repository.loadSummary(project.id);
    const { readJsonFile } = await import("../../atlas-core/src/index.js");
    return await readJsonFile<RouteSummary>(join(project.folderPath, "route_summary.json"));
  } catch {
    return undefined;
  }
}

async function readResearchPack(project: RouteProject, repository?: ProjectRepository): Promise<any> {
  try {
    if (repository) {
      const content = await repository.readProjectFile(project.id, "research_pack.json");
      return JSON.parse(content);
    }
    const { readJsonFile } = await import("../../atlas-core/src/index.js");
    return await readJsonFile<any>(join(project.folderPath, "research_pack.json"));
  } catch {
    return undefined;
  }
}

async function readClaims(project: RouteProject, repository?: ProjectRepository): Promise<Claim[]> {
  try {
    if (repository) return await repository.loadClaims(project.id);
    const { readJsonFile } = await import("../../atlas-core/src/index.js");
    return await readJsonFile<Claim[]>(join(project.folderPath, "claims.json"));
  } catch {
    return [];
  }
}

async function readPois(project: RouteProject, repository?: ProjectRepository): Promise<Poi[]> {
  try {
    const content = repository 
      ? await repository.readProjectFile(project.id, "poi.geojson")
      : await readFile(join(project.folderPath, "poi.geojson"), "utf8");
    const geojson = JSON.parse(content);
    return geojson.features.map((f: any) => ({
      name: f.properties.name,
      description: f.properties.description
    }));
  } catch {
    return [];
  }
}

async function readConcept(project: RouteProject, repository?: ProjectRepository): Promise<string | undefined> {
  try {
    if (repository) return await repository.readProjectFile(project.id, "route_concept.md");
    return await readFile(join(project.folderPath, "route_concept.md"), "utf8");
  } catch {
    return undefined;
  }
}

async function readApprovals(project: RouteProject, repository?: ProjectRepository): Promise<Approvals | undefined> {
  try {
    if (repository) return await repository.loadApprovals(project.id);
    const { readJsonFile } = await import("../../atlas-core/src/index.js");
    return await readJsonFile<Approvals>(join(project.folderPath, "approvals.json"));
  } catch {
    return undefined;
  }
}
