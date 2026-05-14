import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { 
  readJsonFile, 
  writeJsonFile, 
  type RouteProject, 
  type RouteSummary,
  type MissingInputs
} from "../../../atlas-core/src/index.js";

type GpxPoint = {
  lat: number;
  lon: number;
  ele?: number;
  time?: string;
};

export async function analyzeGpx(project: RouteProject): Promise<RouteSummary> {
  const now = new Date().toISOString();
  // We check both the main project folder and the input/gpx folder
  let gpxPath = join(project.folderPath, "route.gpx");
  
  // Try to find the first GPX in input/gpx if the main one doesn't exist
  if (!(await fileExists(gpxPath))) {
    const inputGpxDir = join(project.folderPath, "input", "gpx");
    try {
      const { loadInputManifest } = await import("../../../atlas-core/src/index.js");
      const manifest = await loadInputManifest(project.folderPath);
      const gpxItem = manifest.items.find(i => i.type === "gpx");
      if (gpxItem) {
        gpxPath = join(project.folderPath, gpxItem.path);
      }
    } catch {
      // Ignore
    }
  }

  if (!(await fileExists(gpxPath))) {
    throw new Error(`No GPX file found for project: ${project.id}`);
  }

  const gpxContent = await readFile(gpxPath, "utf8");
  const points = parseGpxPoints(gpxContent);

  if (points.length < 2) {
    throw new Error("GPX file contains too few points for analysis.");
  }

  const stats = calculateStats(points);
  
  if (stats.distanceKm < 0.5) {
    const missing: MissingInputs = {
      projectId: project.id,
      generatedAt: now,
      blocking: true,
      missing: [{
        code: "gpx_too_short",
        message: `GPX track is too short (${stats.distanceKm.toFixed(2)} km). Minimum 1km recommended for Atlas guides.`,
        requiredFor: "guide_final"
      }]
    };
    await writeJsonFile(join(project.folderPath, "missing_inputs.json"), missing);
    throw new Error(`GPX too short: ${stats.distanceKm.toFixed(2)} km`);
  }

  const summary: RouteSummary = {
    distanceKm: Math.round(stats.distanceKm * 10) / 10,
    elevationGainM: Math.round(stats.elevationGainM),
    estimatedTimeH: Math.round((stats.distanceKm / 15) * 10) / 10,
    difficulty: inferDifficulty(stats),
    riskLevel: "unknown",
    loopType: stats.isLoop ? "loop" : "point_to_point",
    season: "May-October",
    startPoint: `Start in ${project.region} (lat: ${points[0].lat.toFixed(3)})`,
    endPoint: stats.isLoop ? "Back to start" : `End in ${project.region} (lat: ${points[points.length - 1].lat.toFixed(3)})`,
    surfaceType: "mixed",
    hasElevation: stats.hasElevation,
    hasTime: stats.hasTime,
    isLoop: stats.isLoop,
    validationStatus: "needs_validation",
    updatedAt: now
  };

  await writeJsonFile(join(project.folderPath, "route_summary.json"), summary);
  
  // Save elevation profile
  await writeJsonFile(join(project.folderPath, "elevation_profile.json"), {
    projectId: project.id,
    points: stats.elevationProfile
  });

  return summary;
}

function parseGpxPoints(xml: string): GpxPoint[] {
  const points: GpxPoint[] = [];
  const trkptRegex = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>(.*?)<\/trkpt>/gs;
  const eleRegex = /<ele>([^<]+)<\/ele>/;
  const timeRegex = /<time>([^<]+)<\/time>/;

  let match;
  while ((match = trkptRegex.exec(xml)) !== null) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    const inner = match[3];
    
    const eleMatch = eleRegex.exec(inner);
    const timeMatch = timeRegex.exec(inner);

    points.push({
      lat,
      lon,
      ele: eleMatch ? parseFloat(eleMatch[1]) : undefined,
      time: timeMatch ? timeMatch[1] : undefined
    });
  }

  return points;
}

function calculateStats(points: GpxPoint[]) {
  let distanceKm = 0;
  let elevationGainM = 0;
  const elevationProfile: { d: number; e: number }[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    
    const d = haversineDistance(p1.lat, p1.lon, p2.lat, p2.lon);
    distanceKm += d;

    if (p1.ele !== undefined && p2.ele !== undefined) {
      const diff = p2.ele - p1.ele;
      if (diff > 0) elevationGainM += diff;
    }

    if (i % Math.max(1, Math.floor(points.length / 50)) === 0) {
      elevationProfile.push({ d: Math.round(distanceKm * 10) / 10, e: Math.round(p1.ele ?? 0) });
    }
  }

  const start = points[0];
  const end = points[points.length - 1];
  const startEndDist = haversineDistance(start.lat, start.lon, end.lat, end.lon);
  const isLoop = startEndDist < 0.5 || startEndDist < distanceKm * 0.05;
  const hasElevation = points.some(p => p.ele !== undefined);
  const hasTime = points.some(p => p.time !== undefined);

  return { distanceKm, elevationGainM, isLoop, hasElevation, hasTime, elevationProfile };
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function inferDifficulty(stats: { distanceKm: number, elevationGainM: number }): "easy" | "moderate" | "hard" | "expert" {
  if (stats.distanceKm > 100 || stats.elevationGainM > 2000) return "expert";
  if (stats.distanceKm > 50 || stats.elevationGainM > 1000) return "hard";
  if (stats.distanceKm > 20 || stats.elevationGainM > 500) return "moderate";
  return "easy";
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const { stat } = await import("node:fs/promises");
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
