import { mkdir } from "node:fs/promises";
import type { Topic } from "../../atlas-core/src/index.js";
import { dataPath, scoreTopic, writeJsonFile } from "../../atlas-core/src/index.js";
import { expandKeywords } from "./keyword-expansion.js";

export type DiscoverDemandInput = {
  rootDir: string;
  category: string;
  region: string;
  language: string;
  limit?: number;
};

export async function discoverDemand(input: DiscoverDemandInput): Promise<Topic[]> {
  const keywords = expandKeywords(input);
  const topics = keywords.slice(0, input.limit ?? 10).map((title, index) =>
    scoreTopic({
      title,
      category: input.category,
      region: input.region,
      language: input.language,
      sourceCount: 4 + (index % 3)
    })
  );

  const sorted = topics.sort((a, b) => b.score - a.score);
  await mkdir(dataPath(input.rootDir), { recursive: true });
  await writeJsonFile(dataPath(input.rootDir, "backlog.json"), sorted);
  return sorted;
}
