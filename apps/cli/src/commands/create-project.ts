import { Command } from "commander";
import { createRouteProject } from "../../../../packages/atlas-core/src/index.js";

export function registerCreateProjectCommand(program: Command): void {
  program
    .command("create-project")
    .description("Create a local route project folder")
    .requiredOption("--topic <topic>", "Route topic/title")
    .option("--category <category>", "Route category")
    .option("--region <region>", "Region")
    .option("--language <language>", "Language code", "en")
    .action(async (options) => {
      const project = await createRouteProject({
        rootDir: process.cwd(),
        title: options.topic,
        category: options.category,
        region: options.region,
        language: options.language
      });

      console.log(`Created route project: ${project.id}`);
      console.log(project.folderPath);
    });
}
