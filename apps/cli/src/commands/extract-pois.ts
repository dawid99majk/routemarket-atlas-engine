import { Command } from "commander";
import { extractPois } from "../../../../packages/atlas-research/src/index.js";
import { loadProject } from "./load-project.js";

export function registerExtractPoisCommand(program: Command): void {
  program
    .command("extract-pois")
    .description("Generate poi.geojson with MVP candidate POI")
    .requiredOption("--project <project>", "Project slug")
    .action(async (options) => {
      const project = await loadProject(process.cwd(), options.project);
      const pois = await extractPois(project);
      console.log(`Generated ${pois.length} POI for ${project.id}`);
    });
}
