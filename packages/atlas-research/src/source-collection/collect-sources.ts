import { appendFile } from "node:fs/promises";
import { join } from "node:path";
import type { RouteProject, Source, ProjectRepository } from "../../../atlas-core/src/index.js";
import { MockForumProvider, MockVideoProvider } from "../mock/mock-providers.js";
import { expandKeywords } from "../keyword-expansion.js";
import { createSearchProvider, type SearchProviderMode } from "../providers/provider-factory.js";

export type CollectSourcesInput = {
  project: RouteProject;
  limit?: number;
  provider?: SearchProviderMode;
  googleApiKey?: string;
  repository?: ProjectRepository;
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
    googleApiKey: input.googleApiKey
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

  const notesUpdate = `\n## Source collection ${dateFound}\n\nProvider: ${providerName}\nCollected ${sources.length} sources for query: ${query}\n`;

  if (input.repository) {
    await input.repository.saveSources(input.project.id, sources);
    try {
      const existingNotes = await input.repository.readProjectFile(input.project.id, "notes.md");
      await input.repository.writeProjectFile(input.project.id, "notes.md", existingNotes + notesUpdate);
    } catch {
      await input.repository.writeProjectFile(input.project.id, "notes.md", notesUpdate);
    }
  } else {
    const { writeJsonFile } = await import("../../../atlas-core/src/index.js");
    await writeJsonFile(join(input.project.folderPath, "sources.json"), sources);
    await appendFile(join(input.project.folderPath, "notes.md"), notesUpdate, "utf8");
  }

  return sources;
}
