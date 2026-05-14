import { z } from "zod";

export const RouteSummarySchema = z.object({
  distanceKm: z.number().positive().optional(),
  elevationGainM: z.number().nonnegative().optional(),
  estimatedTimeH: z.number().positive().optional(),
  difficulty: z.enum(["easy", "moderate", "hard", "expert"]).optional(),
  riskLevel: z.enum(["low", "medium", "high", "unknown"]).default("unknown"),
  loopType: z.enum(["loop", "out_and_back", "point_to_point"]).optional(),
  season: z.string().optional(),
  startPoint: z.string().optional(),
  endPoint: z.string().optional(),
  surfaceType: z.string().optional(),
  hasElevation: z.boolean().default(false),
  hasTime: z.boolean().default(false),
  isLoop: z.boolean().default(false),
  validationStatus: z.enum(["draft", "needs_validation", "validated"]).default("needs_validation"),
  updatedAt: z.string()
});

export type RouteSummary = z.infer<typeof RouteSummarySchema>;
