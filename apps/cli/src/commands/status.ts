import { Command } from "commander";
import { loadProject } from "./load-project.js";

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show local project status")
    .requiredOption("--project <project>", "Project slug")
    .action(async (options) => {
      const project = await loadProject(process.cwd(), options.project);
      console.log(JSON.stringify({
        id: project.id,
        title: project.title,
        status: project.status,
        category: project.category,
        region: project.region,
        routemarketRouteId: project.routemarketRouteId ?? null,
        updatedAt: project.updatedAt
      }, null, 2));
    });
}
