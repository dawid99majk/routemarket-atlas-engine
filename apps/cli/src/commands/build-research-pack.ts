import { Command } from "commander";
import { loadProject } from "./load-project.js";
import { buildResearchPack } from "../../../../packages/atlas-research/src/index.js";

export function registerBuildResearchPackCommand(program: Command) {
  program
    .command("build-research-pack")
    .description("Build the consolidated research pack for a project")
    .requiredOption("-p, --project <slug>", "Project slug")
    .action(async (options) => {
      const project = await loadProject(process.cwd(), options.project);
      const pack = await buildResearchPack(project);
      console.log(`Built research pack with ${pack.materials.length} materials.`);
      console.log(`Saved to: ${options.project}/research_pack.json`);
    });
}
