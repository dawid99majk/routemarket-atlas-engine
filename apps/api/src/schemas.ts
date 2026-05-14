import { z } from "zod";

export const DiscoverBodySchema = z.object({
  category: z.string().min(1),
  region: z.string().min(1),
  language: z.string().min(2).default("en"),
  limit: z.number().int().positive().max(50).default(10)
});

export const CreateProjectBodySchema = z.object({
  topic: z.string().min(1),
  category: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  language: z.string().min(2).default("en")
});

export const EmptyBodySchema = z.object({}).passthrough();

export const CollectSourcesBodySchema = z.object({
  provider: z.enum(["auto", "mock", "brave"]).default("auto"),
  limit: z.number().int().positive().max(50).optional()
});

export const DeepResearchBodySchema = z.object({
  sourceLimit: z.number().int().positive().max(20).default(3)
});

export const UpdateProjectStatusBodySchema = z.object({
  status: z.string().min(1)
});

export const SubmitReviewDecisionBodySchema = z.object({
  decision: z.enum(["approved", "changes_requested", "blocked"]),
  reviewer: z.string().min(1).optional(),
  notes: z.string().optional()
});

export const WriteProjectFileBodySchema = z.object({
  content: z.string()
});

export const PruneJobsBodySchema = z.object({
  olderThanMs: z.number().int().nonnegative().optional()
});

export const ArchiveProjectBodySchema = z.object({
  reason: z.string().optional()
});
