import { z } from "zod";

export const EvidenceTypeSchema = z.enum([
  "gpx",
  "notes",
  "pdf",
  "image",
  "youtube",
  "link",
  "conversation",
  "ai_suggestion",
  "osm",
  "places_api"
]);

export const EvidenceLicenseSchema = z.enum([
  "own",
  "licensed",
  "public",
  "unknown",
  "blocked"
]);

export const EvidenceStatusSchema = z.enum([
  "pending",
  "processing",
  "ready",
  "failed",
  "rejected"
]);

export const EvidenceSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  type: EvidenceTypeSchema,
  status: EvidenceStatusSchema,
  sourceId: z.string().optional(), // Reference to external source if applicable
  trustScore: z.number().min(0).max(100),
  licenseStatus: EvidenceLicenseSchema,
  addedAt: z.string().datetime(),
  ownerId: z.string(), // ID of the user or 'system'
  contentUrl: z.string().optional(), // S3/GCS link to raw file
  metadata: z.record(z.string(), z.any()).optional()
});

export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;
export type EvidenceLicense = z.infer<typeof EvidenceLicenseSchema>;
export type EvidenceStatus = z.infer<typeof EvidenceStatusSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
