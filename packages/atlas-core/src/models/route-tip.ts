import { z } from "zod";

export const RouteTipSchema = z.object({
  id: z.string().min(1),
  category: z.enum([
    "before_start_fuel",
    "before_start_network",
    "before_start_weather",
    "before_start_permits",
    "good_tip"
  ]),
  content: z.string().min(1),
  sortOrder: z.number().int().nonnegative().default(0),
  routeMarketTipId: z.string().optional()
});

export type RouteTip = z.infer<typeof RouteTipSchema>;
