import { z } from "zod";

export const MediaAssetSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["cover_candidate", "gallery", "poi", "warning", "generated_prompt", "cover"]),
  source: z.enum(["creator_upload", "ai_prompt", "unknown"]).optional(),
  inputId: z.string().optional(),
  path: z.string().optional(),
  url: z.string().url().optional(),
  assetKey: z.string().optional(),
  prompt: z.string().optional(),
  licenseStatus: z.enum(["creator_owned", "ai_generated", "owned", "licensed", "public_domain", "needs_review", "unknown"]),
  locationStatus: z.enum(["gps_found", "matched_to_route", "unknown"]).optional(),
  approvalStatus: z.enum(["pending", "approved", "rejected"]).optional(),
  notes: z.string().optional(),
  status: z.enum(["active", "duplicate", "unsupported"]).default("active"),
  createdAt: z.string()
});

export const MediaManifestSchema = z.object({
  assets: z.array(MediaAssetSchema),
  updatedAt: z.string()
});

export type MediaAsset = z.infer<typeof MediaAssetSchema>;
export type MediaManifest = z.infer<typeof MediaManifestSchema>;
