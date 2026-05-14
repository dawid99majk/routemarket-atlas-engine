import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RouteProject, Source } from "../../atlas-core/src/index.js";

export type GenerateQualityReportInput = {
  project: RouteProject;
  sources?: Source[];
  gpxValid?: boolean;
  geojsonValid?: boolean;
};

export async function generateQualityReport(input: GenerateQualityReportInput): Promise<string> {
  const sources = input.sources ?? [];
  const sourceCounts = countSources(sources);
  const uncertainFacts = sources.length < 3 ? "- Source coverage is too thin for publication." : "- Key facts still need claim-level verification.";

  const report = `# Quality Report

## Source coverage

- Official sources: ${sourceCounts.official}
- Blogs: ${sourceCounts.blog}
- YouTube: ${sourceCounts.youtube}
- Reddit/forum: ${sourceCounts.reddit + sourceCounts.forum}
- Map sources: ${sourceCounts.map}
- GPX sources: ${sourceCounts.gpx}
- Other: ${sourceCounts.other}

## Confirmed facts

None confirmed automatically in MVP 2.

## Uncertain facts

${uncertainFacts}

## Conflicting information

No conflict detection yet.

## Safety concerns

${safetyLine(input.project.category)}

## Legal/media concerns

- Check source licenses before copying media or GPX.
- AI images must be logged in media/license_report.md.

## GPX validation

${input.gpxValid ? "GPX passed basic XML validation." : "GPX not validated or not available."}

## GeoJSON validation

${input.geojsonValid ? "GeoJSON passed basic FeatureCollection validation." : "GeoJSON not validated or not available."}

## Recommended human review points

- Verify all public claims against at least two independent sources.
- Validate route distance, surface, timing, and safety notes.
- Confirm RouteMarket category, tags, and draft content before publishing.
`;

  await writeFile(join(input.project.folderPath, "quality_report.md"), report, "utf8");
  return report;
}

function countSources(sources: Source[]): Record<Source["sourceType"], number> {
  const counts: Record<Source["sourceType"], number> = {
    blog: 0,
    youtube: 0,
    reddit: 0,
    official: 0,
    map: 0,
    gpx: 0,
    forum: 0,
    other: 0
  };
  for (const source of sources) counts[source.sourceType] += 1;
  return counts;
}

function safetyLine(category: string): string {
  if (category === "motorcycle") return "- Confirm surface, fuel, local rules, border/insurance needs, and emergency fallback points.";
  if (["hiking", "trekking"].includes(category)) return "- Confirm weather exposure, season, water, emergency exits, and terrain difficulty.";
  return "- Confirm category-specific safety and logistics before publishing.";
}
