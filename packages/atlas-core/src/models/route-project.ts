import { z } from "zod";

export const ProjectStatusSchema = z.enum([
  "research_needed",
  "sources_collected",
  "draft_generated",
  "ready_for_review",
  "changes_requested",
  "blocked",
  "approved_for_publish",
  "published",
  "archived"
]);

export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const RouteProjectSchema = z.object({
  id: z.string().min(1),
  topicId: z.string().optional(),
  title: z.string().min(1),
  slug: z.string().min(1),
  category: z.string().min(1),
  region: z.string().min(1),
  language: z.string().min(2),
  status: ProjectStatusSchema,
  folderPath: z.string().min(1),
  routemarketRouteId: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type RouteProject = z.infer<typeof RouteProjectSchema>;
