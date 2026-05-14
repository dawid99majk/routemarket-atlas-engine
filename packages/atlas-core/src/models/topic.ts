import { z } from "zod";

export const TopicStatusSchema = z.enum([
  "idea",
  "research_needed",
  "ready_for_research",
  "in_research",
  "ready_for_route_design",
  "ready_for_gpx",
  "ready_for_guide",
  "ready_for_review",
  "ready_for_publish",
  "published",
  "rejected"
]);

export const TopicSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  region: z.string().min(1),
  language: z.string().min(2),
  score: z.number().min(0).max(100),
  seoScore: z.number().min(0).max(100),
  sourceAvailability: z.number().min(0).max(100),
  contentFeasibility: z.number().min(0).max(100),
  riskScore: z.number().min(0).max(100),
  status: TopicStatusSchema,
  priority: z.enum(["low", "medium", "high"]),
  recommendation: z.enum(["build_now", "research_more", "skip"]),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type TopicStatus = z.infer<typeof TopicStatusSchema>;
export type Topic = z.infer<typeof TopicSchema>;
