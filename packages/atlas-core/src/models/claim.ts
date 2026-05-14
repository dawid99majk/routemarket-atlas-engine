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
    "route_segment"
  ]),
  confidence: z.number().min(0).max(1),
  status: z.enum([
    "confirmed",
    "likely",
    "uncertain",
    "conflicting",
    "unsafe_to_publish"
  ]),
  sources: z.array(z.string())
});

export type Claim = z.infer<typeof ClaimSchema>;
