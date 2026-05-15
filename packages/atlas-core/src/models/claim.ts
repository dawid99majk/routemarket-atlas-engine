import { z } from "zod";

export const ClaimSchema = z.object({
  id: z.string().min(1),
  topicId: z.string().min(1),
  claim: z.string().min(1),
  claimType: z.enum([
    "poi",
    "safety",
    "season",
    "distance",
    "difficulty",
    "logistics",
    "route_segment",
    "surface",
    "access",
    "cost",
    "legal"
  ]),
  confidence: z.number().min(0).max(1),
  status: z.enum([
    "extracted",
    "likely",
    "verified",
    "contradicted",
    "uncertain",
    "needs_creator_review"
  ]),
  sources: z.array(z.string()),
  evidenceQuotes: z.array(z.string()).optional(),
  usedInSections: z.array(z.string()).optional(),
  needsHumanReview: z.boolean().default(false)
});

export type Claim = z.infer<typeof ClaimSchema>;
