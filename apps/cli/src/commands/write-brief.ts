import { Command } from "commander";
import { join } from "node:path";
import { readJsonFile, routesPath, type RouteProject, type Source } from "../../../../packages/atlas-core/src/index.js";
import { generateResearchBrief } from "../../../../packages/atlas-writer/src/index.js";

export function registerWriteBriefCommand(program: Command): void {
  program
    .command("write-brief")
    .description("Generate a research brief for a route project")
    .requiredOption("--project <project>", "Project slug")
    .action(async (options) => {
      const projectFolder = routesPath(process.cwd(), options.project);
      const project = await readJsonFile<RouteProject>(join(projectFolder, "project.json"));
      const sources = await readJsonFile<Source[]>(join(projectFolder, "sources.json"));
      const brief = await generateResearchBrief({ project, sources });
      console.log(`Wrote brief for ${project.id} (${brief.length} characters)`);
    });
}
