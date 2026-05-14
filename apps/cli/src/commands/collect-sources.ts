import { Command } from "commander";
import { join } from "node:path";
import { readJsonFile, routesPath, type RouteProject } from "../../../../packages/atlas-core/src/index.js";
import { collectSources, type SearchProviderMode } from "../../../../packages/atlas-research/src/index.js";

const searchProviderModes = ["auto", "mock", "brave"] as const;

export function registerCollectSourcesCommand(program: Command): void {
  program
    .command("collect-sources")
    .description("Collect sources for a route project")
    .requiredOption("--project <project>", "Project slug")
    .option("--limit <limit>", "Max sources", "20")
    .option("--provider <provider>", "Search provider: auto | mock | brave", "auto")
    .action(async (options) => {
      const project = await readJsonFile<RouteProject>(join(routesPath(process.cwd(), options.project), "project.json"));
      const sources = await collectSources({ project, limit: Number(options.limit), provider: parseSearchProviderMode(options.provider) });
      console.log(`Collected ${sources.length} sources for ${project.id}`);
    });
}

function parseSearchProviderMode(value: string): SearchProviderMode {
  if (searchProviderModes.includes(value as SearchProviderMode)) return value as SearchProviderMode;
  throw new Error(`Unsupported search provider "${value}". Use: ${searchProviderModes.join(", ")}.`);
}
