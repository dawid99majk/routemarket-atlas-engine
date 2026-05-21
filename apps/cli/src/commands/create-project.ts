import { Command } from "commander";
import { AtlasWorkflowService } from "../../../../packages/atlas-workflow/src/index.js";

export function registerCreateProjectCommand(program: Command): void {
  program
    .command("create-project")
    .description("Create a local route project folder")
    .requiredOption("--topic <topic>", "Route topic/title")
    .option("--category <category>", "Route category")
    .option("--region <region>", "Region")
    .option("--language <language>", "Language code", "en")
    .action(async (options) => {
      const service = new AtlasWorkflowService({ rootDir: process.cwd() });
      const project = await service.createProject({
        topic: options.topic,
        category: options.category,
        region: options.region,
        language: options.language
      });

      console.log(`Created route project: ${project.id}`);
      console.log(project.folderPath);
    });
}
