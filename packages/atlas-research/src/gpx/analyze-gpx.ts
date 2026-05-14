import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { 
  readJsonFile, 
  writeJsonFile, 
  type RouteProject, 
  type RouteSummary 
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
  
  const summary: RouteSummary = {
    distanceKm: Math.round(stats.distanceKm * 10) / 10,
    elevationGainM: Math.round(stats.elevationGainM),
    estimatedTimeH: Math.round((stats.distanceKm / 15) * 10) / 10, // Default 15km/h for motorcycle/cycling?
    difficulty: inferDifficulty(stats),
    riskLevel: "low",
    loopType: stats.isLoop ? "loop" : "point_to_point",
    season: "May-October",
    startPoint: `${points[0].lat.toFixed(5)}, ${points[0].lon.toFixed(5)}`,
    endPoint: `${points[points.length - 1].lat.toFixed(5)}, ${points[points.length - 1].lon.toFixed(5)}`,
    surfaceType: "mixed",
    validationStatus: "draft",
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

  return { distanceKm, elevationGainM, isLoop, elevationProfile };
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
