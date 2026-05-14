import type { RouteProject } from "../../atlas-core/src/index.js";

export type DashboardSummary = {
  totalProjects: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  readyForReview: number;
  recentProjects: RouteProject[];
};

export function buildDashboardSummary(projects: RouteProject[]): DashboardSummary {
  return {
    totalProjects: projects.length,
    byStatus: countBy(projects, "status"),
    byCategory: countBy(projects, "category"),
    readyForReview: projects.filter((project) => project.status === "ready_for_review").length,
    recentProjects: projects.slice(0, 10)
  };
}

function countBy(projects: RouteProject[], key: "status" | "category"): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const project of projects) {
    counts[project[key]] = (counts[project[key]] ?? 0) + 1;
  }
  return counts;
}
