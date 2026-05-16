import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RouteProject, Source } from "../../atlas-core/src/index.js";

export type GenerateGuideDraftInput = {
  project: RouteProject;
  sources?: Source[];
  concept?: string;
};

export async function generateGuideDraft(input: GenerateGuideDraftInput): Promise<string> {
  const sourceSummary = (input.sources ?? [])
    .slice(0, 8)
    .map((source) => `- ${source.title} (${source.sourceType})`)
    .join("\n");

  const guide = `# ${input.project.title}

## Short intro

This is an early RouteMarket draft for a ${input.project.category} route in ${input.project.region}. It is prepared from the current research pack and must be reviewed before publication.

## Who is this route for?

This route is for travelers who want a practical, source-aware route rather than a generic list of places.

## Route overview

- Distance: needs GPX validation
- Duration: needs validation
- Difficulty: needs review
- Best season: needs source confirmation
- Start: needs route design
- Finish: needs route design
- Surface: needs confirmation
- Required experience: depends on validated route
- GPX included: not yet validated

## Why this route is worth doing

The topic appears to fit RouteMarket because it combines destination intent, route intent, and practical navigation needs.

## Route description

Detailed route description should be written after the route concept is verified against sources and map data.

## Key places on the route

POI extraction is pending. Add only places confirmed by sources or map data.

## Practical information

Keep logistics practical: transport, fuel or water, parking, food, timing, offline maps, and seasonal constraints.

## Safety notes

Do not publish this section until risks are reviewed. Mark uncertain warnings clearly.

## Best time to go

Needs confirmation from current local and official sources.

## Gear / preparation

Prepare according to category, season, weather, distance, terrain, and remoteness.

## Variants

Variants should be added after the main route is stable.

## Sources and verification

${sourceSummary || "No sources collected yet."}

## Disclaimer

This draft is AI-assisted and requires human review before publishing. Conditions, access rules, weather, and route safety can change.
`;

  await writeFile(join(input.project.folderPath, "guide.md"), guide, "utf8");
  return guide;
}
