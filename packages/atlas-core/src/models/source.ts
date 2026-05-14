import { z } from "zod";

export const SourceTypeSchema = z.enum([
  "blog",
  "youtube",
  "reddit",
  "official",
  "map",
  "gpx",
  "forum",
  "other"
]);

export const SourceSchema = z.object({
  id: z.string().min(1),
  topicId: z.string().min(1),
  url: z.string().url(),
  title: z.string().min(1),
  sourceType: SourceTypeSchema,
  language: z.string().min(2),
  relevanceScore: z.number().min(0).max(100),
  trustScore: z.number().min(0).max(100),
  licenseStatus: z.enum(["unknown", "safe", "unsafe", "needs_review"]),
  contentSummary: z.string(),
  dateFound: z.string(),
  notes: z.string().optional(),
  // Deep Research enhancements
  rawContentPath: z.string().optional(), // Path to scraped text/html for vectorization
  deepResearchStatus: z.enum(["pending", "scraped", "failed", "processed"]).optional()
});

export type SourceType = z.infer<typeof SourceTypeSchema>;
export type Source = z.infer<typeof SourceSchema>;
