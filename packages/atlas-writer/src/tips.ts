import { join } from "node:path";
import type { RouteProject, RouteTip, ProjectRepository } from "../../atlas-core/src/index.js";

export async function generateRouteTips(project: RouteProject, repository?: ProjectRepository): Promise<RouteTip[]> {
  const tips: RouteTip[] = [
    {
      id: "tip_001",
      category: "before_start_weather",
      content: weatherTip(project),
      sortOrder: 1
    },
    {
      id: "tip_002",
      category: project.category === "motorcycle" ? "before_start_fuel" : "before_start_network",
      content: logisticsTip(project),
      sortOrder: 2
    },
    {
      id: "tip_003",
      category: "good_tip",
      content: "Keep the GPX offline and check local conditions before starting. This draft still requires human review.",
      sortOrder: 3
    }
  ];

  if (repository) {
    await repository.saveArtifact(project.id, "tips", tips);
  } else {
    const { writeJsonFile } = await import("../../atlas-core/src/index.js");
    await writeJsonFile(join(project.folderPath, "tips.json"), tips);
  }
  return tips;
}

function weatherTip(project: RouteProject): string {
  if (project.category === "motorcycle") return `Check weather separately for mountain and lowland sections in ${project.region}. Conditions can change quickly on scenic roads.`;
  return `Check current weather and seasonal access before starting this ${project.category} route in ${project.region}.`;
}

function logisticsTip(project: RouteProject): string {
  if (project.category === "motorcycle") return "Refuel before remote or mountain sections and do not wait for reserve range.";
  return "Download offline maps and keep the route available outside mobile coverage.";
}
