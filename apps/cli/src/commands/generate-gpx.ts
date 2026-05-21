import { Command } from "commander";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { MockRoutingProvider, buildGpxXml } from "../../../../packages/atlas-gis/src/index.js";
import { readJsonFile, type Poi } from "../../../../packages/atlas-core/src/index.js";
import { loadProject } from "./load-project.js";

export function registerGenerateGpxCommand(program: Command): void {
  program
    .command("generate-gpx")
    .description("Generate GPX track from project POIs/waypoints")
    .requiredOption("--project <project>", "Project slug")
    .option("--profile <profile>", "Routing profile (motorcycle, bike, hiking)", "motorcycle")
    .action(async (options) => {
      const project = await loadProject(process.cwd(), options.project);
      
      let pois: Poi[] = [];
      try {
        const poiData = await readJsonFile<any>(join(project.folderPath, "poi_candidates.json"));
        if (poiData && Array.isArray(poiData.pois)) {
          pois = poiData.pois;
        }
      } catch (err) {
        console.warn("Could not load poi_candidates.json, looking for alternative waypoints...");
      }

      if (pois.length < 2) {
        throw new Error("Project needs at least 2 POIs in poi_candidates.json to generate a route.");
      }

      // Filter only confirmed or suggested POIs with valid coordinates
      const waypoints = pois
        .filter(p => p.status !== "rejected" && p.lat !== 0 && p.lng !== 0)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      if (waypoints.length < 2) {
        throw new Error("Not enough valid waypoints (min 2) to generate a route.");
      }

      console.log(`Generating route for ${waypoints.length} waypoints using ${options.profile} profile...`);
      
      const apiKey = process.env.GRAPHHOPPER_API_KEY;
      let routingProvider;
      
      if (apiKey) {
        console.log("Using GraphHopper routing service...");
        const { GraphHopperRoutingProvider } = await import("../../../../packages/atlas-gis/src/index.js");
        routingProvider = new GraphHopperRoutingProvider(apiKey);
      } else {
        console.log("No GraphHopper API key found. Falling back to Mock routing...");
        routingProvider = new MockRoutingProvider();
      }

      const routingResult = await routingProvider.getRoute(
        waypoints.map(p => ({ lat: p.lat, lng: p.lng })),
        options.profile as any
      );

      const gpxXml = buildGpxXml(routingResult, waypoints);
      const outputPath = join(project.folderPath, "generated_route.gpx");
      
      await writeFile(outputPath, gpxXml, "utf8");
      
      console.log(`GPX file generated successfully: ${outputPath}`);
      console.log(`Stats: ${routingResult.distanceKm} km, ${routingResult.estimatedTimeH} h`);
    });
}
