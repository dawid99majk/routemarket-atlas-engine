import { Command } from "commander";
import { prepareRouteMarketDraft, publishToRouteMarket } from "../../../../packages/atlas-publisher/src/index.js";
import { loadProject } from "./load-project.js";
import { AtlasWorkflowService } from "../../../../packages/atlas-workflow/src/index.js";

export function registerPreparePublishCommand(program: Command): void {
  program
    .command("prepare-publish")
    .description("Prepare routemarket_payload.json for a route project")
    .requiredOption("--project <project>", "Project slug")
    .option("--mode <mode>", "Publish mode: dry-run | create-draft", "dry-run")
    .action(async (options) => {
      const project = await loadProject(process.cwd(), options.project);
      try {
        const prepared = await prepareRouteMarketDraft(project);
        
        console.log(`\nRouteMarket Payload Prepared (${options.mode} mode)`);
        console.log(`- Project: ${project.id}`);
        console.log(`- Artifacts included: GPX, POI, Tips, Recommendations`);
        console.log(`- Payload saved to: ${project.folderPath}/routemarket_payload.json`);
        
        if (options.mode === "dry-run") {
          console.log("\n[DRY RUN] Payload preview:");
          console.log(JSON.stringify(prepared.draft, null, 2));
        } else if (options.mode === "create-draft") {
          console.log("\n[PUBLISH] Sending payload to RouteMarket API...");
          const result = await publishToRouteMarket(prepared);
          
          if (result.success) {
            console.log(`\n[SUCCESS] Route published as draft!`);
            if (result.remoteId) console.log(`- Remote Route ID: ${result.remoteId}`);
            if (result.message) console.log(`- Message: ${result.message}`);

            // Update project status to published
            const service = new AtlasWorkflowService({ rootDir: process.cwd() });
            await service.setProjectStatus(project.id, "published");
            console.log(`- Project status updated to 'published'.`);
          } else {
            console.error(`\n[FAILED] RouteMarket API returned success:false`);
            if (result.message) console.error(`- Error: ${result.message}`);
            process.exit(1);
          }
        }
      } catch (err: any) {
        if (err.name === "QualityGateError") {
          console.error(`\n[BLOCKED] Quality Gates failed for project ${project.id}. Preparation aborted.`);
          console.error(`The following issues must be resolved before publishing:`);
          for (const issue of err.issues) {
            console.error(` - [${issue.rule}] ${issue.message}`);
          }
          process.exit(1);
        } else {
          console.error(`\n[ERROR] Publication failed: ${err.message}`);
          process.exit(1);
        }
      }
    });
}
