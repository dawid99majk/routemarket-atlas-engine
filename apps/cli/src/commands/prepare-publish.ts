import { Command } from "commander";
import { prepareRouteMarketDraft } from "../../../../packages/atlas-publisher/src/index.js";
import { loadProject } from "./load-project.js";

export function registerPreparePublishCommand(program: Command): void {
  program
    .command("prepare-publish")
    .description("Prepare routemarket_payload.json for a route project")
    .requiredOption("--project <project>", "Project slug")
    .option("--mode <mode>", "Publish mode: dry-run | create-draft", "dry-run")
    .action(async (options) => {
      const project = await loadProject(process.cwd(), options.project);
      const prepared = await prepareRouteMarketDraft(project);
      
      console.log(`\nRouteMarket Payload Prepared (${options.mode} mode)`);
      console.log(`- Project: ${project.id}`);
      console.log(`- Artifacts included: GPX, POI, Tips, Recommendations`);
      console.log(`- Payload saved to: ${project.id}/routemarket_payload.json`);
      
      if (options.mode === "dry-run") {
        console.log("\n[DRY RUN] Payload preview:");
        console.log(JSON.stringify(prepared.draft, null, 2));
      }
    });
}
