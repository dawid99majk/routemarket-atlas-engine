import { join } from "node:path";
import type { Recommendation, RouteProject } from "../../atlas-core/src/index.js";
import { writeJsonFile } from "../../atlas-core/src/index.js";

export async function generateRecommendations(project: RouteProject): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [
    {
      id: "rec_001",
      name: `${project.region} local food stop`,
      description: "Placeholder recommendation. Replace with a source-verified local place before publishing.",
      whatToOrder: "Local specialty after source verification",
      priceRange: "mid-range",
      sortOrder: 0
    }
  ];

  await writeJsonFile(join(project.folderPath, "recommendations.json"), recommendations);
  return recommendations;
}
