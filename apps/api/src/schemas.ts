import { z } from "zod";
import { ProjectStatusSchema } from "../../../packages/atlas-core/src/index.js";

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
  status: ProjectStatusSchema
});

export const SubmitReviewDecisionBodySchema = z.object({
  decision: z.enum(["approved", "changes_requested", "blocked"]),
  reviewer: z.string().min(1).optional(),
  notes: z.string().optional()
});

export const WriteProjectFileBodySchema = z.object({
  content: z.string()
});

export const JobApprovalBodySchema = z.object({
  approvalData: z.any().optional()
});

export const PruneJobsBodySchema = z.object({
  olderThanMs: z.number().int().nonnegative().optional()
});

export const ArchiveProjectBodySchema = z.object({
  reason: z.string().optional()
});

export const AddNoteBodySchema = z.object({
  fileName: z.string().min(1).max(120),
  content: z.string().min(1).max(1_000_000),
  note: z.string().max(500).optional()
});

export const AddGpxBodySchema = z.object({
  fileName: z.string().min(1).max(120),
  content: z.string().min(1).max(5_000_000),
  note: z.string().max(500).optional()
});

export const AddLinkBodySchema = z.object({
  url: z.string().url(),
  note: z.string().max(500).optional()
});
