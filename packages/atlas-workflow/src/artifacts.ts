import { access, stat } from "node:fs/promises";
import { join } from "node:path";

export type ProjectArtifact = {
  path: string;
  label: string;
  type: "markdown" | "json" | "geojson" | "gpx" | "text";
  exists: boolean;
  sizeBytes?: number;
  updatedAt?: string;
};

export const projectArtifactDefinitions: Omit<ProjectArtifact, "exists" | "sizeBytes" | "updatedAt">[] = [
  { path: "project.json", label: "Project metadata", type: "json" },
  { path: "brief.md", label: "Research brief", type: "markdown" },
  { path: "sources.json", label: "Sources", type: "json" },
  { path: "claims.json", label: "Claims", type: "json" },
  { path: "notes.md", label: "Notes", type: "markdown" },
  { path: "poi.geojson", label: "POI", type: "geojson" },
  { path: "route_concept.md", label: "Route concept", type: "markdown" },
  { path: "guide.md", label: "Guide draft", type: "markdown" },
  { path: "tips.json", label: "Route tips", type: "json" },
  { path: "recommendations.json", label: "Recommendations", type: "json" },
  { path: "quality_report.md", label: "Quality report", type: "markdown" },
  { path: "review_checklist.md", label: "Review checklist", type: "markdown" },
  { path: "routemarket_payload.json", label: "RouteMarket payload", type: "json" },
  { path: "deep_research.json", label: "Deep research report", type: "json" },
  { path: "research/deep/source_001.txt", label: "Deep research source 1", type: "text" },
  { path: "research/deep/source_002.txt", label: "Deep research source 2", type: "text" },
  { path: "research/deep/source_003.txt", label: "Deep research source 3", type: "text" },
  { path: "route.gpx", label: "GPX track", type: "gpx" },
  { path: "route.geojson", label: "Route GeoJSON", type: "geojson" },
  { path: "media/license_report.md", label: "Media license report", type: "markdown" },
  { path: "media/manifest.json", label: "Media manifest", type: "json" }
];

export async function listProjectArtifacts(projectFolder: string): Promise<ProjectArtifact[]> {
  return Promise.all(
    projectArtifactDefinitions.map(async (definition) => {
      const path = join(projectFolder, definition.path);
      try {
        await access(path);
        const fileStat = await stat(path);
        return {
          ...definition,
          exists: true,
          sizeBytes: fileStat.size,
          updatedAt: fileStat.mtime.toISOString()
        };
      } catch {
        return { ...definition, exists: false };
      }
    })
  );
}
