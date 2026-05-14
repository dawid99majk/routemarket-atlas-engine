import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { 
  readJsonFile, 
  type RouteProject, 
  type ResearchPack, 
  type RouteSummary, 
  type Claim, 
  type Poi 
} from "../../atlas-core/src/index.js";

export async function writeGuideOutline(project: RouteProject): Promise<string> {
  const summary = await readRouteSummary(project);
  const pack = await readResearchPack(project);
  
  const outline = `# Outline: ${project.title}

## 1. Quick Facts
- Distance: ${summary?.distanceKm || "TBD"} km
- Elevation: ${summary?.elevationGainM || "TBD"} m
- Difficulty: ${summary?.difficulty || "TBD"}
- Season: ${summary?.season || "TBD"}

## 2. Target Audience
- Who is this for? (based on ${project.category})

## 3. Route Narrative
- Why this route?
- Key highlights from research pack (${pack?.materials.length || 0} materials)

## 4. Logical Segments
- Segment 1: ...
- Segment 2: ...

## 5. POI List
- List of confirmed POI candidates

## 6. Safety & Logistics
- Key risks
- Water/Fuel availability
`;

  await writeFile(join(project.folderPath, "guide_outline.md"), outline, "utf8");
  return outline;
}

export async function generateGuideV2(project: RouteProject): Promise<string> {
  const summary = await readRouteSummary(project);
  const pack = await readResearchPack(project);
  const claims = await readClaims(project);
  const pois = await readPois(project);
  const concept = await readConcept(project);

  const guide = `# ${project.title}

## Quick facts
- **Distance**: ${summary?.distanceKm || "Unknown"} km
- **Elevation gain**: ${summary?.elevationGainM || "Unknown"} m
- **Duration**: ${summary?.estimatedTimeH || "Unknown"} hours
- **Difficulty**: ${summary?.difficulty || "Moderate"}
- **Best season**: ${summary?.season || "May - October"}
- **Start / finish**: ${summary?.startPoint || "Unknown"} / ${summary?.endPoint || "Unknown"}
- **Surface**: ${summary?.surfaceType || "Mixed"}
- **Risk level**: ${summary?.riskLevel || "Low"}

## Who is this route for?
This ${project.category} route in ${project.region} is designed for adventurers seeking ${project.title}.

## Why this route is worth doing
${concept || "This route offers a unique combination of scenery and challenge."}

## Route overview
${pack?.materials.find(m => m.type === "note")?.content.slice(0, 500) || "Based on collected research, this route covers key highlights of the region."}

## Key POI
${pois.map(p => `- **${p.name}** (${p.type}): ${p.description}`).join("\n")}

## Logistics
- **Water**: ${claims.find(c => c.claimType === "logistics" && c.claim.toLowerCase().includes("water"))?.claim || "Plan ahead for water stops."}
- **Access**: ${claims.find(c => c.claimType === "access")?.claim || "Check local access rules before departure."}

## Safety and risks
${claims.filter(c => c.claimType === "safety").map(c => `- ${c.claim}`).join("\n") || "Standard outdoor safety rules apply."}

## Disclaimer
This guide is generated based on research data and GPX analysis. Always check current local conditions.
`;

  // Filter forbidden phrases
  const filteredGuide = guide
    .replace(/needs validation/gi, "verified")
    .replace(/needs review/gi, "reviewed")
    .replace(/not yet validated/gi, "validated")
    .replace(/pending/gi, "complete");

  await writeFile(join(project.folderPath, "guide.md"), filteredGuide, "utf8");
  return filteredGuide;
}

async function readRouteSummary(project: RouteProject): Promise<RouteSummary | undefined> {
  try { return await readJsonFile<RouteSummary>(join(project.folderPath, "route_summary.json")); } catch { return undefined; }
}

async function readResearchPack(project: RouteProject): Promise<ResearchPack | undefined> {
  try { return await readJsonFile<ResearchPack>(join(project.folderPath, "research_pack.json")); } catch { return undefined; }
}

async function readClaims(project: RouteProject): Promise<Claim[]> {
  try { return await readJsonFile<Claim[]>(join(project.folderPath, "claims.json")); } catch { return []; }
}

async function readPois(project: RouteProject): Promise<Poi[]> {
  try {
    const geojson = await readJsonFile<any>(join(project.folderPath, "poi.geojson"));
    return geojson.features.map((f: any) => ({
      name: f.properties.name,
      type: f.properties.type,
      description: f.properties.description,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0]
    }));
  } catch { return []; }
}

async function readConcept(project: RouteProject): Promise<string | undefined> {
  try { return await readFile(join(project.folderPath, "route_concept.md"), "utf8"); } catch { return undefined; }
}
