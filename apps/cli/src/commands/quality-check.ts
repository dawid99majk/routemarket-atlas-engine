import { Command } from "commander";
import { join } from "node:path";
import { generateQualityReport } from "../../../../packages/atlas-writer/src/index.js";
import { validateGeoJsonFile, validateGpxFile } from "../../../../packages/atlas-gis/src/index.js";
import { loadProject, loadProjectSources } from "./load-project.js";

export function registerQualityCheckCommand(program: Command): void {
  program
    .command("quality-check")
    .description("Generate quality_report.md for a route project")
    .requiredOption("--project <project>", "Project slug")
    .action(async (options) => {
      const project = await loadProject(process.cwd(), options.project);
      const sources = await loadProjectSources(project);
      const gpx = await validateGpxFile(join(project.folderPath, "route.gpx")).catch(() => ({ valid: false }));
      const geojson = await validateGeoJsonFile(join(project.folderPath, "route.geojson")).catch(() => ({ valid: false }));
      const report = await generateQualityReport({
        project,
        sources,
        gpxValid: gpx.valid,
        geojsonValid: geojson.valid
      });
      console.log(`Wrote quality report for ${project.id} (${report.length} characters)`);
    });
}
