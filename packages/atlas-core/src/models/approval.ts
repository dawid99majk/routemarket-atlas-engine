import { z } from "zod";

export const ApprovalStageSchema = z.enum([
  "topic_approval",
  "sources_approval",
  "research_pack_approval",
  "claims_approval",
  "gpx_summary_approval",
  "poi_approval",
  "concept_approval",
  "guide_outline_approval",
  "guide_final_approval",
  "media_approval",
  "publish_payload_approval"
]);

export const ApprovalDecisionSchema = z.enum(["approved", "changes_requested", "rejected"]);

export const ApprovalRecordSchema = z.object({
  stage: ApprovalStageSchema,
  decision: ApprovalDecisionSchema,
  reviewer: z.string(),
  notes: z.string().optional(),
  decidedAt: z.string(),
  dataPatchPath: z.string().optional(),
  artifactHashes: z.record(z.string(), z.string()).optional(),
  audit: z.object({
    changedClaims: z.number().optional(),
    verifiedClaims: z.number().optional(),
    likelyClaims: z.number().optional(),
    unchangedClaims: z.number().optional(),
    changedPoi: z.number().optional()
  }).optional()
});

export const ApprovalsSchema = z.object({
  projectId: z.string(),
  updatedAt: z.string(),
  approvals: z.array(ApprovalRecordSchema)
});

export type ApprovalStage = z.infer<typeof ApprovalStageSchema>;
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;
export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>;
export type Approvals = z.infer<typeof ApprovalsSchema>;
