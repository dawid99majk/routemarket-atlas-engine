import { Command } from "commander";
import { prepareMediaPack } from "../../../../packages/atlas-writer/src/index.js";
import { loadProject } from "./load-project.js";

export function registerPrepareMediaCommand(program: Command): void {
  program
    .command("prepare-media")
    .description("Prepare media manifest and license report")
    .requiredOption("--project <project>", "Project slug")
    .action(async (options) => {
      const project = await loadProject(process.cwd(), options.project);
      const manifest = await prepareMediaPack(project);
      console.log(`Prepared ${manifest.assets.length} media prompts for ${project.id}`);
    });
}
