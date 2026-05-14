import { z } from "zod";

export const InputItemTypeSchema = z.enum(["note", "document", "photo", "gpx", "link"]);
export const InputItemStatusSchema = z.enum(["added", "processed", "ignored", "needs_review"]);

export const InputItemSchema = z.object({
  id: z.string(),
  type: InputItemTypeSchema,
  path: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  addedAt: z.string(),
  status: InputItemStatusSchema,
  notes: z.string().optional()
});

export const InputManifestSchema = z.object({
  projectId: z.string(),
  updatedAt: z.string(),
  items: z.array(InputItemSchema)
});

export type InputItemType = z.infer<typeof InputItemTypeSchema>;
export type InputItemStatus = z.infer<typeof InputItemStatusSchema>;
export type InputItem = z.infer<typeof InputItemSchema>;
export type InputManifest = z.infer<typeof InputManifestSchema>;
