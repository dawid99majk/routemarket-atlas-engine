import { Command } from "commander";
import { prepareRouteMarketDraft } from "../../../../packages/atlas-publisher/src/index.js";
import { loadProject } from "./load-project.js";

export function registerPreparePublishCommand(program: Command): void {
  program
    .command("prepare-publish")
    .description("Prepare routemarket_payload.json for a route project")
    .requiredOption("--project <project>", "Project slug")
    .action(async (options) => {
      const project = await loadProject(process.cwd(), options.project);
      const prepared = await prepareRouteMarketDraft(project);
      console.log(`Prepared RouteMarket payload for ${project.id}`);
      console.log(JSON.stringify(prepared.draft, null, 2));
    });
}
