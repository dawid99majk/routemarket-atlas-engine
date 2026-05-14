import type { Topic } from "../models/topic.js";
import { slugify } from "../projects/slug.js";

export type ScoreTopicInput = {
  title: string;
  category: string;
  region: string;
  language: string;
  sourceCount?: number;
};

export function scoreTopic(input: ScoreTopicInput): Topic {
  const now = new Date().toISOString();
  const demandIntent = scoreDemandIntent(input.title);
  const sourceAvailability = clamp(45 + (input.sourceCount ?? 3) * 8);
  const routeMarketFit = scoreRouteMarketFit(input.category);
  const seoScore = scoreSeoPotential(input.title, input.region);
  const contentFeasibility = scoreFeasibility(input.category);
  const seasonalityBonus = scoreSeasonality(input.title);
  const riskScore = scoreRisk(input.title, input.category);

  const score = clamp(
    0.25 * demandIntent +
      0.2 * sourceAvailability +
      0.2 * routeMarketFit +
      0.15 * seoScore +
      0.1 * contentFeasibility +
      0.1 * seasonalityBonus -
      0.2 * riskScore
  );

  return {
    id: slugify(input.title),
    title: input.title,
    category: input.category,
    region: input.region,
    language: input.language,
    score,
    seoScore,
    sourceAvailability,
    contentFeasibility,
    riskScore,
    status: score >= 75 ? "ready_for_research" : "research_needed",
    priority: score >= 80 ? "high" : score >= 60 ? "medium" : "low",
    recommendation: score >= 78 ? "build_now" : score >= 50 ? "research_more" : "skip",
    createdAt: now,
    updatedAt: now
  };
}

function scoreDemandIntent(title: string): number {
  const lowered = title.toLowerCase();
  let score = 45;
  if (lowered.includes("gpx")) score += 22;
  if (lowered.includes("route")) score += 14;
  if (lowered.includes("itinerary")) score += 12;
  if (/\b\d+\s*(days?|dni)\b/.test(lowered)) score += 10;
  if (lowered.includes("hidden gems")) score += 8;
  return clamp(score);
}

function scoreRouteMarketFit(category: string): number {
  const fit: Record<string, number> = {
    motorcycle: 90,
    hiking: 88,
    trekking: 86,
    cycling: 84,
    gravel: 84,
    mtb: 82,
    running: 76,
    city_walk: 74,
    roadtrip: 82,
    car: 78
  };
  return fit[category] ?? 65;
}

function scoreSeoPotential(title: string, region: string): number {
  const lowered = title.toLowerCase();
  let score = 52;
  if (region.length > 2) score += 10;
  if (lowered.includes("best")) score += 8;
  if (lowered.includes("gpx")) score += 16;
  if (lowered.includes("route")) score += 10;
  if (lowered.includes("guide")) score += 8;
  return clamp(score);
}

function scoreFeasibility(category: string): number {
  if (["city_walk", "running", "cycling"].includes(category)) return 82;
  if (["hiking", "roadtrip", "car"].includes(category)) return 76;
  if (category === "motorcycle") return 72;
  return 68;
}

function scoreSeasonality(title: string): number {
  const lowered = title.toLowerCase();
  if (lowered.includes("summer") || lowered.includes("spring") || lowered.includes("autumn")) return 80;
  if (lowered.includes("winter")) return 55;
  return 65;
}

function scoreRisk(title: string, category: string): number {
  const lowered = title.toLowerCase();
  let risk = 20;
  if (["motorcycle", "trekking", "hiking"].includes(category)) risk += 15;
  if (lowered.includes("offroad") || lowered.includes("off-road")) risk += 18;
  if (lowered.includes("winter")) risk += 20;
  if (lowered.includes("expert")) risk += 15;
  return clamp(risk);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
