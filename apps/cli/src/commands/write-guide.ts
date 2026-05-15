import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Command } from "commander";
import { generateGuideDraft } from "../../../../packages/atlas-writer/src/index.js";
import { loadProject, loadProjectSources } from "./load-project.js";

export function registerWriteGuideCommand(program: Command): void {
  program
    .command("write-guide")
    .description("LEGACY: generate a weak draft shell guide.md (not final guide v2)")
    .requiredOption("--project <project>", "Project slug")
    .action(async (options) => {
      const project = await loadProject(process.cwd(), options.project);
      const sources = await loadProjectSources(project);
      const concept = await readFile(join(project.folderPath, "route_concept.md"), "utf8");
      const guide = await generateGuideDraft({ project, sources, concept });
      console.warn("Warning: write-guide is a legacy draft-shell command. Use run-mvp2 with approvals for final guide v2.");
      console.log(`Wrote guide draft for ${project.id} (${guide.length} characters)`);
    });
}
