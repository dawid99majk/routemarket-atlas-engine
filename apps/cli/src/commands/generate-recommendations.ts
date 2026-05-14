import { Command } from "commander";
import { generateRecommendations } from "../../../../packages/atlas-writer/src/index.js";
import { loadProject } from "./load-project.js";

export function registerGenerateRecommendationsCommand(program: Command): void {
  program
    .command("generate-recommendations")
    .description("Generate recommendations.json placeholders")
    .requiredOption("--project <project>", "Project slug")
    .action(async (options) => {
      const project = await loadProject(process.cwd(), options.project);
      const recommendations = await generateRecommendations(project);
      console.log(`Generated ${recommendations.length} recommendations for ${project.id}`);
    });
}
