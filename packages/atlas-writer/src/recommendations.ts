import { join } from "node:path";
import type { Recommendation, RouteProject, ProjectRepository } from "../../atlas-core/src/index.js";

export async function generateRecommendations(project: RouteProject, repository?: ProjectRepository): Promise<Recommendation[]> {
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

  if (repository) {
    await repository.saveArtifact(project.id, "recommendations", recommendations);
  } else {
    const { writeJsonFile } = await import("../../atlas-core/src/index.js");
    await writeJsonFile(join(project.folderPath, "recommendations.json"), recommendations);
  }
  return recommendations;
}
