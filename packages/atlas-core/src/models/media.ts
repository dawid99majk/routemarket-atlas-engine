import { z } from "zod";

export const MediaAssetSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["cover", "gallery", "poi"]),
  path: z.string().optional(),
  url: z.string().url().optional(),
  assetKey: z.string().optional(),
  prompt: z.string().optional(),
  licenseStatus: z.enum(["ai_generated", "owned", "licensed", "public_domain", "needs_review"]),
  notes: z.string().optional(),
  createdAt: z.string()
});

export const MediaManifestSchema = z.object({
  assets: z.array(MediaAssetSchema),
  updatedAt: z.string()
});

export type MediaAsset = z.infer<typeof MediaAssetSchema>;
export type MediaManifest = z.infer<typeof MediaManifestSchema>;
