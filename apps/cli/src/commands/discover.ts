import { Command } from "commander";
import { discoverDemand } from "../../../../packages/atlas-research/src/index.js";

export function registerDiscoverCommand(program: Command): void {
  program
    .command("discover")
    .description("Discover route topics and write data/backlog.json")
    .requiredOption("--category <category>", "Route category, e.g. motorcycle")
    .requiredOption("--region <region>", "Region, e.g. Albania")
    .option("--language <language>", "Language code", "en")
    .option("--limit <limit>", "Max topics", "10")
    .action(async (options) => {
      const topics = await discoverDemand({
        rootDir: process.cwd(),
        category: options.category,
        region: options.region,
        language: options.language,
        limit: Number(options.limit)
      });

      console.table(
        topics.map((topic) => ({
          score: topic.score,
          title: topic.title,
          recommendation: topic.recommendation,
          priority: topic.priority
        }))
      );
    });
}
