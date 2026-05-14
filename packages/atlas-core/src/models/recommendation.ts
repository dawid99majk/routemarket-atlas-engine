import { z } from "zod";

export const RecommendationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  whatToOrder: z.string().optional(),
  priceRange: z.enum(["budget", "mid-range", "premium"]).default("mid-range"),
  photoKey: z.string().optional(),
  sortOrder: z.number().int().nonnegative().default(0),
  routeMarketRecommendationId: z.string().optional()
});

export type Recommendation = z.infer<typeof RecommendationSchema>;
