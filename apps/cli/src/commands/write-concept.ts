import { Command } from "commander";
import { generateRouteConcept } from "../../../../packages/atlas-writer/src/index.js";
import { loadProject, loadProjectSources } from "./load-project.js";

export function registerWriteConceptCommand(program: Command): void {
  program
    .command("write-concept")
    .description("Generate route_concept.md for a route project")
    .requiredOption("--project <project>", "Project slug")
    .action(async (options) => {
      const project = await loadProject(process.cwd(), options.project);
      const sources = await loadProjectSources(project);
      const concept = await generateRouteConcept({ project, sources });
      console.log(`Wrote route concept for ${project.id} (${concept.length} characters)`);
    });
}
