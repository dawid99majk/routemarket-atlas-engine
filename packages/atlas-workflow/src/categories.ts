import { routeMarketCategoryIds } from "../../atlas-publisher/src/index.js";

export type AtlasCategory = {
  id: string;
  label: string;
  routeMarketCategoryId?: number;
  activityGroup: "outdoor" | "urban" | "vehicle" | "water" | "winter";
};

export function listAtlasCategories(): AtlasCategory[] {
  return [
    category("motorcycle", "Motorcycle", "vehicle"),
    category("cycling", "Cycling", "outdoor"),
    category("gravel", "Gravel", "outdoor"),
    category("mtb", "MTB", "outdoor"),
    category("hiking", "Hiking", "outdoor"),
    category("trekking", "Trekking", "outdoor"),
    category("roadtrip", "Road trip", "vehicle"),
    category("running", "Running", "outdoor"),
    category("trail_running", "Trail running", "outdoor"),
    category("city_walk", "City walk", "urban"),
    category("winter_sports", "Winter sports", "winter"),
    category("water_sports", "Water sports", "water")
  ];
}

function category(id: string, label: string, activityGroup: AtlasCategory["activityGroup"]): AtlasCategory {
  return {
    id,
    label,
    activityGroup,
    routeMarketCategoryId: routeMarketCategoryIds[id]
  };
}
