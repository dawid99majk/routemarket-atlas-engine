import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RouteProject, Source } from "../../atlas-core/src/index.js";

export type GenerateResearchBriefInput = {
  project: RouteProject;
  sources?: Source[];
};

export async function generateResearchBrief(input: GenerateResearchBriefInput): Promise<string> {
  const sourceLines = (input.sources ?? [])
    .map((source) => `- ${source.title} (${source.sourceType}) - ${source.url}`)
    .join("\n");

  const brief = `# Research brief

Topic: ${input.project.title}
Category: ${input.project.category}
Region: ${input.project.region}
Language: ${input.project.language}
Target user: ${targetUser(input.project.category)}
Goal: create a practical RouteMarket-ready research pack for this route.

## Research questions

- Which route segments are most important?
- Which places are must-see POI?
- What is the recommended season?
- What are the main safety or logistics warnings?
- Are there GPX/map references available legally?
- What facts require two or more independent sources?

## Required sources

- official/local source,
- at least two independent travel or outdoor sources,
- map source,
- forum/video source when useful,
- legal media or own/generated media later.

## Constraints

- Do not invent distance, elevation gain, surface, or difficulty.
- Mark uncertain facts clearly.
- Keep all sources in \`sources.json\`.
- Draft status only until human review.

## Current sources

${sourceLines || "No sources collected yet."}
`;

  await writeFile(join(input.project.folderPath, "brief.md"), brief, "utf8");
  return brief;
}

function targetUser(category: string): string {
  const users: Record<string, string> = {
    motorcycle: "adventure motorcycle traveler",
    hiking: "independent hiker",
    trekking: "multi-day trekker",
    cycling: "recreational cyclist",
    running: "runner",
    city_walk: "city explorer",
    roadtrip: "road trip traveler"
  };
  return users[category] ?? "route traveler";
}
