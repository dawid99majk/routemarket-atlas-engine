import { Command } from "commander";
import { AtlasWorkflowService } from "../../../../packages/atlas-workflow/src/index.js";

export function registerDeepResearchCommand(program: Command): void {
  program
    .command("deep-research")
    .description("Run deep research extraction for collected sources")
    .requiredOption("--project <project>", "Project slug")
    .option("--source-limit <limit>", "Max sources to process", "3")
    .action(async (options) => {
      const service = new AtlasWorkflowService({ rootDir: process.cwd() });
      const report = await service.runDeepResearch(options.project, {
        sourceLimit: Number(options.sourceLimit)
      });
      console.log(JSON.stringify(report, null, 2));
    });
}
