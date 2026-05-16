import { Command } from "commander";
import { loadProject } from "./load-project.js";
import { analyzeGpx } from "../../../../packages/atlas-research/src/index.js";

export function registerAnalyzeGpxCommand(program: Command) {
  program
    .command("analyze-gpx")
    .description("Perform deep analysis of the project GPX file")
    .requiredOption("-p, --project <slug>", "Project slug")
    .action(async (options) => {
      const project = await loadProject(process.cwd(), options.project);
      const summary = await analyzeGpx(project);
      console.log(`\nGPX Analysis complete for: ${project.title}`);
      console.log(`- Distance: ${summary.distanceKm} km`);
      console.log(`- Elevation Gain: ${summary.elevationGainM} m`);
      console.log(`- Difficulty: ${summary.difficulty}`);
      console.log(`- Loop: ${summary.loopType === "loop" ? "Yes" : "No"}`);
      console.log(`- Start: ${summary.startPoint}`);
      console.log(`- End: ${summary.endPoint}`);
      console.log(`\nSummary saved to: ${project.id}/route_summary.json`);
    });
}
