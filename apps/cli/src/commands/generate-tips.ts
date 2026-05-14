import { Command } from "commander";
import { generateRouteTips } from "../../../../packages/atlas-writer/src/index.js";
import { loadProject } from "./load-project.js";

export function registerGenerateTipsCommand(program: Command): void {
  program
    .command("generate-tips")
    .description("Generate tips.json for RouteMarket wizard tips")
    .requiredOption("--project <project>", "Project slug")
    .action(async (options) => {
      const project = await loadProject(process.cwd(), options.project);
      const tips = await generateRouteTips(project);
      console.log(`Generated ${tips.length} tips for ${project.id}`);
    });
}
