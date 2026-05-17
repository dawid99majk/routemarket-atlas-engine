import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { 
  type Poi, 
  type RouteProject, 
  type ResearchPack,
  type ProjectRepository
} from "../../../atlas-core/src/index.js";

export async function extractPois(project: RouteProject, repository?: ProjectRepository): Promise<Poi[]> {
  const now = new Date().toISOString();
  const candidates: Poi[] = [];

  // 1. Extract from GPX waypoints
  const gpxPois = await extractFromGpx(project, repository);
  candidates.push(...gpxPois);

  // 2. Extract from Deep Research / Research Pack
  const researchPois = await extractFromResearch(project, repository);
  candidates.push(...researchPois);

  // 3. De-duplicate by name and coordinates
  const uniquePois = deduplicatePois(candidates);

  // 4. Save candidates
  if (repository) {
    await repository.saveArtifact(project.id, "poi_candidates", {
      projectId: project.id,
      updatedAt: now,
      pois: uniquePois
    });
  } else {
    const { writeJsonFile } = await import("../../../atlas-core/src/index.js");
    await writeJsonFile(join(project.folderPath, "poi_candidates.json"), {
      projectId: project.id,
      updatedAt: now,
      pois: uniquePois
    });
  }

  // 5. Save to GeoJSON (only those with coordinates and not rejected)
  const geojson = {
    type: "FeatureCollection",
    features: uniquePois
      .filter(p => p.lat !== 0 && p.lng !== 0 && p.status !== "rejected")
      .map((poi) => ({
        type: "Feature",
        properties: {
          id: poi.id,
          name: poi.name,
          type: poi.type,
          status: poi.status,
          description: poi.description,
          fun_fact: poi.funFact,
          contactPhone: poi.contactPhone,
          priceRange: poi.priceRange,
          isVerified: poi.isVerifiedByDeepResearch
        },
        geometry: {
          type: "Point",
          coordinates: [poi.lng, poi.lat]
        }
      }))
  };

  if (repository) {
    await repository.writeProjectFile(project.id, "poi.geojson", `${JSON.stringify(geojson, null, 2)}\n`);
  } else {
    await writeFile(join(project.folderPath, "poi.geojson"), `${JSON.stringify(geojson, null, 2)}\n`, "utf8");
  }
  
  return uniquePois;
}

async function extractFromGpx(project: RouteProject, repository?: ProjectRepository): Promise<Poi[]> {
  try {
    const xml = repository 
      ? await repository.readProjectFile(project.id, "route.gpx")
      : await readFile(join(project.folderPath, "route.gpx"), "utf8");

    const wptRegex = /<wpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>(.*?)<\/wpt>/gs;
    const nameRegex = /<name>([^<]+)<\/name>/;
    const descRegex = /<desc>([^<]+)<\/desc>/;
    const typeRegex = /<type>([^<]+)<\/type>/;

    const pois: Poi[] = [];
    let match;
    while ((match = wptRegex.exec(xml)) !== null) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      const inner = match[3];

      const nameMatch = nameRegex.exec(inner);
      const descMatch = descRegex.exec(inner);
      const typeMatch = typeRegex.exec(inner);

      pois.push({
        id: `poi_gpx_${pois.length + 1}_${Date.now()}`,
        name: nameMatch ? nameMatch[1] : "Unnamed Waypoint",
        type: (typeMatch ? typeMatch[1] : "marker") as any,
        lat,
        lng,
        description: descMatch ? descMatch[1] : "",
        status: "suggested",
        sortOrder: pois.length
      });
    }
    return pois;
  } catch {
    return [];
  }
}

async function extractFromResearch(project: RouteProject, repository?: ProjectRepository): Promise<Poi[]> {
  const pois: Poi[] = [];
  try {
    const pack = repository
      ? await repository.readProjectFile(project.id, "research_pack.json").then(c => JSON.parse(c) as ResearchPack)
      : await readJsonFileFallback<ResearchPack>(join(project.folderPath, "research_pack.json"));
    // Placeholder: normally we'd LLM-extract POIs from content.
  } catch {}

  try {
    const deep = repository
      ? await repository.readProjectFile(project.id, "deep_research.json").then(c => JSON.parse(c) as any)
      : await readJsonFileFallback<any>(join(project.folderPath, "deep_research.json"));

    if (deep && Array.isArray(deep.pois)) {
      deep.pois.forEach((p: any, index: number) => {
        pois.push({
          id: `poi_deep_${index}_${Date.now()}`,
          name: p.name,
          type: p.type || "landmark",
          lat: p.lat || 0,
          lng: p.lng || 0,
          description: p.description || "",
          contactPhone: p.contactPhone,
          website: p.website,
          isVerifiedByDeepResearch: true,
          status: "suggested",
          sortOrder: index
        });
      });
    }
  } catch {}

  return pois;
}

function deduplicatePois(pois: Poi[]): Poi[] {
  const result: Poi[] = [];
  for (const poi of pois) {
    const isDuplicate = result.some(p => {
      const nameMatch = p.name.toLowerCase() === poi.name.toLowerCase();
      const dist = p.lat !== 0 && poi.lat !== 0 ? haversineDistance(p.lat, p.lng, poi.lat, poi.lng) : 1000;
      return nameMatch || dist < 0.05; // 50 meters
    });
    if (!isDuplicate) {
      result.push({
        ...poi,
        status: poi.status || "suggested"
      });
    }
  }
  return result;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function readJsonFileFallback<T>(path: string): Promise<T> {
  const { readJsonFile } = await import("../../../atlas-core/src/index.js");
  return readJsonFile<T>(path);
}
