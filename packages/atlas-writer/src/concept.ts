import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RouteProject, Source, ProjectRepository } from "../../atlas-core/src/index.js";

export type GenerateRouteConceptInput = {
  project: RouteProject;
  sources?: Source[];
  repository?: ProjectRepository;
};

export async function generateRouteConcept(input: GenerateRouteConceptInput): Promise<string> {
  const sourceCount = input.sources?.length ?? 0;
  const concept = `# Route Concept

## Working title

${input.project.title}

## Route promise

A practical ${input.project.category} route in ${input.project.region}, designed for RouteMarket review with transparent source coverage and clear uncertainty.

## Target traveler

${targetTraveler(input.project.category)}

## Proposed structure

- Start and finish: use validated GPX coordinates and editor-approved place names.
- Distance and elevation: use the approved route summary only.
- Difficulty: derive from distance, elevation, route category, and human review.
- Surface and season: include only when creator notes or trusted sources support them.
- Safety: separate verified route risks from general preparation advice.

## Key research basis

Current source count: ${sourceCount}

## Draft route logic

1. Start with the most accessible logistics base.
2. Connect the highest-value scenic or cultural segments.
3. Add safety and practical checkpoints before writing final claims.
4. Keep uncertain distances and surfaces out of the public draft until validated.

## RouteMarket readiness

Status: concept only. Do not publish before source verification, GPX validation, and quality review.
`;

  if (input.repository) {
    await input.repository.writeProjectFile(input.project.id, "route_concept.md", concept);
  } else {
    await writeFile(join(input.project.folderPath, "route_concept.md"), concept, "utf8");
  }
  return concept;
}

function targetTraveler(category: string): string {
  const map: Record<string, string> = {
    motorcycle: "Adventure rider who wants scenic roads, surface notes, fuel awareness, and offline navigation.",
    hiking: "Independent hiker who wants a clear route, season notes, and safety context.",
    cycling: "Cyclists who wants a manageable ride with surface and logistics details.",
    running: "Runner who wants a clear route, distance confidence, and terrain notes.",
    city_walk: "City explorer who wants a self-guided route with useful stops.",
    roadtrip: "Road trip traveler who wants scenic flow, stops, and realistic timing."
  };
  return map[category] ?? "Route traveler who wants a practical, verified guide.";
}
