import { appendFile } from "node:fs/promises";
import { join } from "node:path";
import type { RouteProject, Source } from "../../../atlas-core/src/index.js";
import { writeJsonFile } from "../../../atlas-core/src/index.js";
import { MockForumProvider, MockVideoProvider } from "../mock/mock-providers.js";
import { expandKeywords } from "../keyword-expansion.js";
import { createSearchProvider, type SearchProviderMode } from "../providers/provider-factory.js";

export type CollectSourcesInput = {
  project: RouteProject;
  limit?: number;
  provider?: SearchProviderMode;
  braveApiKey?: string;
};

export async function collectSources(input: CollectSourcesInput): Promise<Source[]> {
  const keywords = expandKeywords({
    category: input.project.category,
    region: input.project.region,
    language: input.project.language
  });
  const query = keywords[0] ?? input.project.title;
  const { provider: searchProvider, providerName } = createSearchProvider({
    mode: input.provider,
    braveApiKey: input.braveApiKey
  });
  const videoProvider = new MockVideoProvider();
  const forumProvider = new MockForumProvider();

  const candidates = [
    ...(await searchProvider.search({ query, category: input.project.category, region: input.project.region, language: input.project.language, limit: input.limit })),
    ...(await videoProvider.searchVideos({ query, category: input.project.category, region: input.project.region, language: input.project.language, limit: input.limit })),
    ...(await forumProvider.searchDiscussions({ query, category: input.project.category, region: input.project.region, language: input.project.language, limit: input.limit }))
  ];

  const dateFound = new Date().toISOString().slice(0, 10);
  const sources = candidates.slice(0, input.limit ?? 20).map<Source>((candidate, index) => ({
    id: `source_${String(index + 1).padStart(3, "0")}`,
    topicId: input.project.id,
    dateFound,
    ...candidate
  }));

  await writeJsonFile(join(input.project.folderPath, "sources.json"), sources);
  await appendFile(
    join(input.project.folderPath, "notes.md"),
    `\n## Source collection ${dateFound}\n\nProvider: ${providerName}\nCollected ${sources.length} sources for query: ${query}\n`,
    "utf8"
  );

  return sources;
}
