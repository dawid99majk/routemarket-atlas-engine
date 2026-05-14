import type { RouteProject } from "../../atlas-core/src/index.js";

export type ProjectListFilters = {
  status?: string;
  category?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

export type FilteredProjects = {
  projects: RouteProject[];
  total: number;
  limit: number;
  offset: number;
};

export function filterProjects(projects: RouteProject[], filters: ProjectListFilters = {}): FilteredProjects {
  const q = filters.q?.trim().toLowerCase();
  const filtered = projects.filter((project) => {
    if (filters.status && project.status !== filters.status) return false;
    if (filters.category && project.category !== filters.category) return false;
    if (q) {
      const haystack = `${project.title} ${project.slug} ${project.region} ${project.category}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const limit = Math.max(1, Math.min(filters.limit ?? 50, 200));
  const offset = Math.max(0, filters.offset ?? 0);
  return {
    projects: filtered.slice(offset, offset + limit),
    total: filtered.length,
    limit,
    offset
  };
}
