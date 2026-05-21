import { z } from "zod";

export const PoiSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["viewpoint", "water", "food", "shelter", "landmark", "hazard", "other"]),
  lat: z.number(),
  lng: z.number(),
  description: z.string().optional(),
  funFact: z.string().optional(),
  sortOrder: z.number().int().nonnegative().default(0),
  routeMarketPoiId: z.string().optional(),
  // Deep Research enhancements
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  website: z.string().url().optional(),
  priceRange: z.string().optional(),
  openingHours: z.string().optional(),
  waterAvailability: z.enum(["unknown", "available", "seasonal", "none"]).optional(),
  facilities: z.array(z.string()).optional(),
  isVerifiedByDeepResearch: z.boolean().optional(),
  placeId: z.string().optional(),
  rating: z.number().optional(),
  userRatingCount: z.number().optional(),
  types: z.array(z.string()).optional(),
  verificationSource: z.enum(["google_places", "deep_research", "manual", "placeholder"]).optional(),
  status: z.enum(["suggested", "confirmed", "rejected"]).default("suggested"),
  approvalDecision: z.string().optional()
});

export type Poi = z.infer<typeof PoiSchema>;
