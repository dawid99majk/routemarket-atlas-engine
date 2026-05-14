export type KeywordExpansionInput = {
  category: string;
  region: string;
  language: string;
};

export function expandKeywords(input: KeywordExpansionInput): string[] {
  const categoryLabel = categoryToQuery(input.category);
  const base = `${input.region} ${categoryLabel}`;

  const variants = [
    `${base} route`,
    `${base} GPX`,
    `${base} itinerary`,
    `${base} guide`,
    `${base} best route`,
    `${base} scenic route`
  ];

  if (input.category === "motorcycle") {
    variants.push(`${input.region} adventure motorcycle route`, `${input.region} motorcycle roadtrip`);
  }

  if (["hiking", "trekking"].includes(input.category)) {
    variants.push(`${input.region} hiking trail GPX`, `${input.region} day hike guide`);
  }

  if (input.category === "city_walk") {
    variants.push(`${input.region} walking tour hidden gems`, `${input.region} self guided walk`);
  }

  return [...new Set(variants)];
}

function categoryToQuery(category: string): string {
  const labels: Record<string, string> = {
    motorcycle: "motorcycle",
    hiking: "hiking",
    trekking: "trekking",
    city_walk: "walking tour",
    roadtrip: "road trip",
    cycling: "cycling",
    running: "running",
    gravel: "gravel cycling",
    mtb: "MTB"
  };
  return labels[category] ?? category;
}
