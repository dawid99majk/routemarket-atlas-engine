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

type RouteWarning = { code: string; message: string; severity: "low" | "medium" | "high" };
type RouteSegment = {
  index: number;
  from: string;
  to: string;
  distanceKm: number;
  elevationGainM?: number;
  estimatedTimeH?: number;
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
  const parsed = parseGpxPoints(gpxContent);
  const points = parsed.points;
  const warnings: RouteWarning[] = [...parsed.warnings];

  if (points.length < 2) {
    throw new Error("GPX file contains too few points for analysis.");
  }

  const stats = calculateStats(points);
  warnings.push(...stats.warnings);
  
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
    elevationGainM: stats.hasElevation ? Math.round(stats.elevationGainM) : undefined,
    estimatedTimeH: estimateTime(project.category, stats.distanceKm, stats.elevationGainM, stats.elapsedHours),
    difficulty: inferDifficulty(stats),
    riskLevel: "unknown",
    loopType: stats.isLoop ? "loop" : "point_to_point",
    startPoint: formatPoint(points[0]),
    endPoint: stats.isLoop ? "Back to start" : formatPoint(points[points.length - 1]),
    season: undefined,
    surfaceType: undefined,
    hasElevation: stats.hasElevation,
    hasTime: stats.hasTime,
    isLoop: stats.isLoop,
    routeSegments: stats.routeSegments,
    warnings: warnings.map(w => ({ code: w.code, message: w.message })),
    validationStatus: "needs_validation",
    updatedAt: now
  };

  await writeJsonFile(join(project.folderPath, "route_summary.json"), summary);
  
  // Save elevation profile
  await writeJsonFile(join(project.folderPath, "elevation_profile.json"), {
    projectId: project.id,
    points: stats.elevationProfile
  });

  await writeJsonFile(join(project.folderPath, "route_warnings.json"), {
    projectId: project.id,
    warnings,
    updatedAt: now
  });
  await writeJsonFile(join(project.folderPath, "route_segments.json"), {
    projectId: project.id,
    segments: stats.routeSegments,
    updatedAt: now
  });
  await writeJsonFile(join(project.folderPath, "route_segments.geojson"), buildSegmentsGeoJson(project.id, stats.segmentLines, points));

  return summary;
}

function parseGpxPoints(xml: string): { points: GpxPoint[]; warnings: RouteWarning[] } {
  const points: GpxPoint[] = [];
  const warnings: RouteWarning[] = [];
  let source = "track_points";
  let pointRegex = /<trkpt\b([^>]*)>(.*?)<\/trkpt>/gis;
  if (!pointRegex.test(xml)) {
    pointRegex = /<rtept\b([^>]*)>(.*?)<\/rtept>/gis;
    source = "route_points";
  }
  pointRegex.lastIndex = 0;
  const attrRegex = /\b(lat|lon)=["']([^"']+)["']/gi;
  const eleRegex = /<ele>([^<]+)<\/ele>/;
  const timeRegex = /<time>([^<]+)<\/time>/;

  let match;
  let skipped = 0;
  while ((match = pointRegex.exec(xml)) !== null) {
    const attrs = match[1];
    const values: Record<string, string> = {};
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrs)) !== null) values[attrMatch[1].toLowerCase()] = attrMatch[2];
    const lat = parseFloat(values.lat ?? "");
    const lon = parseFloat(values.lon ?? "");
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      skipped += 1;
      continue;
    }
    const inner = match[2];
    
    const eleMatch = eleRegex.exec(inner);
    const timeMatch = timeRegex.exec(inner);
    const ele = eleMatch ? parseFloat(eleMatch[1]) : undefined;

    points.push({
      lat,
      lon,
      ele: ele !== undefined && Number.isFinite(ele) ? ele : undefined,
      time: timeMatch ? timeMatch[1] : undefined
    });
  }
  warnings.push({ code: source, message: `Analyzed GPX using ${source === "track_points" ? "track points" : "route points"}.`, severity: "low" });
  if (skipped > 0) warnings.push({ code: "invalid_points_skipped", message: `Skipped ${skipped} GPX point(s) with invalid coordinates.`, severity: "medium" });

  return { points, warnings };
}

function calculateStats(points: GpxPoint[]) {
  let distanceKm = 0;
  let elevationGainM = 0;
  const elevationProfile: { d: number; e: number }[] = [];
  const warnings: RouteWarning[] = [];
  const routeSegments: RouteSegment[] = [];
  const segmentLines: Array<RouteSegment & { coordinates: number[][]; pointCount: number }> = [];
  let segmentDistance = 0;
  let segmentGain = 0;
  const segmentSize = Math.max(1, Math.floor((points.length - 1) / 5));

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    
    const d = haversineDistance(p1.lat, p1.lon, p2.lat, p2.lon);
    distanceKm += d;
    segmentDistance += d;

    if (p1.ele !== undefined && p2.ele !== undefined) {
      const diff = p2.ele - p1.ele;
      if (diff > 0) {
        elevationGainM += diff;
        segmentGain += diff;
      }
    }

    if (i % Math.max(1, Math.floor(points.length / 50)) === 0) {
      elevationProfile.push({ d: Math.round(distanceKm * 10) / 10, e: Math.round(p1.ele ?? 0) });
    }

    const isSegmentBoundary = (i + 1) % segmentSize === 0 || i === points.length - 2;
    if (isSegmentBoundary) {
      const index = routeSegments.length + 1;
      const startIndex = Math.max(0, i + 1 - segmentSize);
      const segmentPoints = points.slice(startIndex, i + 2);
      const summary = {
        index,
        from: formatPoint(points[startIndex]),
        to: formatPoint(p2),
        distanceKm: Math.round(segmentDistance * 10) / 10,
        elevationGainM: Math.round(segmentGain)
      };
      routeSegments.push(summary);
      segmentLines.push({
        ...summary,
        pointCount: segmentPoints.length,
        coordinates: segmentPoints.map((point) => [point.lon, point.lat])
      });
      segmentDistance = 0;
      segmentGain = 0;
    }
  }

  const start = points[0];
  const end = points[points.length - 1];
  const startEndDist = haversineDistance(start.lat, start.lon, end.lat, end.lon);
  const isLoop = startEndDist < 0.5 || startEndDist < distanceKm * 0.05;
  const hasElevation = points.some(p => p.ele !== undefined);
  const hasTime = points.some(p => p.time !== undefined);
  const elapsedHours = elapsedTimeHours(points);
  if (!hasElevation) warnings.push({ code: "missing_elevation", message: "GPX does not contain elevation data.", severity: "medium" });
  if (!hasTime) warnings.push({ code: "missing_timestamps", message: "GPX does not contain timestamps, so duration is estimated by category.", severity: "low" });
  if (distanceKm < 1) warnings.push({ code: "suspiciously_short_track", message: `GPX track is suspiciously short (${distanceKm.toFixed(2)} km).`, severity: "high" });

  return { distanceKm, elevationGainM, isLoop, hasElevation, hasTime, elapsedHours, elevationProfile, routeSegments, segmentLines, warnings };
}

function buildSegmentsGeoJson(projectId: string, segments: Array<RouteSegment & { coordinates: number[][]; pointCount: number }>, fullPoints: GpxPoint[]) {
  return {
    type: "FeatureCollection",
    properties: { projectId },
    features: [
      {
        type: "Feature",
        properties: {
          type: "full_track",
          pointCount: fullPoints.length
        },
        geometry: {
          type: "LineString",
          coordinates: fullPoints.map((p) => [p.lon, p.lat])
        }
      },
      ...segments.map((segment) => ({
        type: "Feature",
        properties: {
          index: segment.index,
          distanceKm: segment.distanceKm,
          elevationGainM: segment.elevationGainM ?? 0,
          pointCount: segment.pointCount,
          start: segment.from,
          end: segment.to,
          type: "segment"
        },
        geometry: {
          type: "LineString",
          coordinates: segment.coordinates
        }
      }))
    ]
  };
}

function elapsedTimeHours(points: GpxPoint[]): number | undefined {
  const first = points.find((p) => p.time)?.time;
  const last = [...points].reverse().find((p) => p.time)?.time;
  if (!first || !last) return undefined;
  const start = Date.parse(first);
  const end = Date.parse(last);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return undefined;
  return Math.round(((end - start) / 3_600_000) * 10) / 10;
}

function estimateTime(category: string, distanceKm: number, elevationGainM: number, elapsedHours?: number): number {
  if (elapsedHours && elapsedHours > 0) return elapsedHours;
  if (category === "motorcycle") return Math.max(0.1, Math.round((distanceKm / 45) * 10) / 10);
  if (category === "bike" || category === "cycling") return Math.max(0.1, Math.round((distanceKm / 15) * 10) / 10);
  if (category === "hiking" || category === "trekking") return Math.max(0.1, Math.round(((distanceKm / 4) + (elevationGainM / 600)) * 10) / 10);
  return Math.max(0.1, Math.round((distanceKm / 10) * 10) / 10);
}

function formatPoint(point: GpxPoint): string {
  return `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`;
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
