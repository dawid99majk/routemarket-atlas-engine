import { Command } from "commander";
import { updateProjectStatus } from "../../../../packages/atlas-core/src/index.js";
import { generateClaims } from "../../../../packages/atlas-research/src/index.js";
import { loadProject, loadProjectSources } from "./load-project.js";

export function registerGenerateClaimsCommand(program: Command): void {
  program
    .command("generate-claims")
    .description("Generate claims.json from collected sources")
    .requiredOption("--project <project>", "Project slug")
    .action(async (options) => {
      const project = await loadProject(process.cwd(), options.project);
      const sources = await loadProjectSources(project);
      const claims = await generateClaims(project, sources);
      await updateProjectStatus(project, "sources_collected");
      console.log(`Generated ${claims.length} claims for ${project.id}`);
    });
}
