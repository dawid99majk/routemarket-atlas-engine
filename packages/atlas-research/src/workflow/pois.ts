import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Poi, RouteProject } from "../../../atlas-core/src/index.js";

export async function extractPois(project: RouteProject): Promise<Poi[]> {
  const pois = defaultPois(project);
  const geojson = {
    type: "FeatureCollection",
    features: pois.map((poi) => ({
      type: "Feature",
      properties: {
        id: poi.id,
        name: poi.name,
        type: poi.type,
        description: poi.description,
        fun_fact: poi.funFact
      },
      geometry: {
        type: "Point",
        coordinates: [poi.lng, poi.lat]
      }
    }))
  };

  await writeFile(join(project.folderPath, "poi.geojson"), `${JSON.stringify(geojson, null, 2)}\n`, "utf8");
  return pois;
}

function defaultPois(project: RouteProject): Poi[] {
  if (project.region.toLowerCase() === "albania") {
    return [
      {
        id: "poi_001",
        name: "Shkoder",
        type: "landmark",
        lat: 42.0693,
        lng: 19.5126,
        description: "Candidate northern Albania logistics base for a motorcycle route.",
        funFact: "Often used as a gateway toward the Albanian Alps.",
        sortOrder: 0
      },
      {
        id: "poi_002",
        name: "Theth area",
        type: "viewpoint",
        lat: 42.3959,
        lng: 19.7745,
        description: "Candidate mountain scenery area requiring road condition checks.",
        funFact: "The area is known for dramatic alpine landscapes.",
        sortOrder: 1
      },
      {
        id: "poi_003",
        name: "Berat",
        type: "landmark",
        lat: 40.7058,
        lng: 19.9522,
        description: "Candidate cultural overnight stop.",
        funFact: "Berat is widely known for its historic Ottoman-era architecture.",
        sortOrder: 2
      }
    ];
  }

  return [];
}
