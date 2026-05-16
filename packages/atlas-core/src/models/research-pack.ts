import { z } from "zod";

export const ResearchMaterialTypeSchema = z.enum(["note", "document", "link", "source", "deep_research"]);
export const ResearchTrustLevelSchema = z.enum(["creator", "official", "map", "community", "unknown"]);
export const ResearchMaterialStatusSchema = z.enum(["active", "unsupported", "duplicate", "usable", "weak", "needs_review"]);

export const ResearchMaterialSchema = z.object({
  id: z.string(),
  inputId: z.string().optional(),
  type: ResearchMaterialTypeSchema,
  title: z.string(),
  content: z.string(),
  sourceUrl: z.string().optional(),
  trustLevel: ResearchTrustLevelSchema,
  status: ResearchMaterialStatusSchema
});

export const ResearchPackSchema = z.object({
  projectId: z.string(),
  topic: z.string(),
  category: z.string(),
  region: z.string(),
  language: z.string(),
  updatedAt: z.string(),
  materials: z.array(ResearchMaterialSchema),
  summary: z.object({
    total: z.number(),
    active: z.number(),
    unsupported: z.number(),
    duplicate: z.number()
  }).optional()
});

export type ResearchMaterialType = z.infer<typeof ResearchMaterialTypeSchema>;
export type ResearchTrustLevel = z.infer<typeof ResearchTrustLevelSchema>;
export type ResearchMaterialStatus = z.infer<typeof ResearchMaterialStatusSchema>;
export type ResearchMaterial = z.infer<typeof ResearchMaterialSchema>;
export type ResearchPack = z.infer<typeof ResearchPackSchema>;
