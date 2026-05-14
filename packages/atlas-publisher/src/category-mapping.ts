export const routeMarketCategoryIds: Record<string, number> = {
  motorcycle: 4,
  motorcycling: 4,
  cycling: 2,
  gravel: 2,
  mtb: 2,
  hiking: 1,
  trekking: 1,
  car: 8,
  roadtrip: 8,
  scenic_drive: 8,
  running: 3,
  trail_running: 3,
  winter_sports: 6,
  water_sports: 7,
  city: 9,
  city_walk: 9
};

export function getRouteMarketCategoryId(category: string): number | undefined {
  return routeMarketCategoryIds[category.toLowerCase()];
}
