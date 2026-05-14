import { Command } from "commander";
import { join } from "node:path";
import { validateGpxFile } from "../../../../packages/atlas-gis/src/index.js";
import { loadProject } from "./load-project.js";

export function registerValidateGpxCommand(program: Command): void {
  program
    .command("validate-gpx")
    .description("Run basic GPX validation for a route project")
    .requiredOption("--project <project>", "Project slug")
    .action(async (options) => {
      const project = await loadProject(process.cwd(), options.project);
      const result = await validateGpxFile(join(project.folderPath, "route.gpx"));
      console.log(JSON.stringify(result, null, 2));
      if (!result.valid) process.exitCode = 1;
    });
}
