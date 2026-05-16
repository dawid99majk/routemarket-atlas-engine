import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Claim, RouteProject, Source } from "../../../atlas-core/src/index.js";
import { readJsonFile, writeJsonFile } from "../../../atlas-core/src/index.js";
import { createDeepResearchProvider } from "../providers/provider-factory.js";
import type { DeepResearchExtractionResult, DeepResearchProvider, PoiCandidate } from "../providers/interfaces.js";
import { GooglePlacesProvider } from "../providers/google-places-provider.js";

export type DeepResearchRun = {
  sourceId: string;
  sourceUrl: string;
  status: "processed" | "failed";
  extractedAt: string;
  rawContentPath?: string;
  candidatePois: PoiCandidate[];
  candidateClaims: DeepResearchExtractionResult["claims"];
  error?: string;
};

export type DeepResearchReport = {
  projectId: string;
  processedSourceCount: number;
  failedSourceCount: number;
  addedClaimCount: number;
  candidatePoiCount: number;
  mappedPoiCount: number;
  runs: DeepResearchRun[];
};

export type RunDeepResearchInput = {
  project: RouteProject;
  sourceLimit?: number;
  provider?: DeepResearchProvider;
};

type GeoJsonFeature = {
  type: "Feature";
  properties?: Record<string, unknown>;
  geometry: {
    type: string;
    coordinates: number[];
  };
};

type PoiFeatureCollection = {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
};

export async function runDeepResearch(input: RunDeepResearchInput): Promise<DeepResearchReport> {
  const provider = input.provider ?? createDeepResearchProvider().provider;
  const sourceLimit = Math.max(1, Math.min(input.sourceLimit ?? 3, 20));
  const sourcesPath = join(input.project.folderPath, "sources.json");
  const claimsPath = join(input.project.folderPath, "claims.json");
  const poiPath = join(input.project.folderPath, "poi.geojson");
  const deepDir = join(input.project.folderPath, "research", "deep");

  const sources = await readJsonFile<Source[]>(sourcesPath);
  const existingClaims = await readOptionalJson<Claim[]>(claimsPath, []);
  const geojson = await readOptionalJson<PoiFeatureCollection>(poiPath, { type: "FeatureCollection", features: [] });
  const selectedSources = sources.filter((source) => source.deepResearchStatus !== "processed").slice(0, sourceLimit);
  const runs: DeepResearchRun[] = [];
  const addedClaims: Claim[] = [];
  let mappedPoiCount = 0;

  await mkdir(deepDir, { recursive: true });

  for (const source of selectedSources) {
    try {
      const result = await provider.scrapeAndExtract(source.url, input.project.title);
      const rawContentPath = `research/deep/${source.id}.txt`;
      await writeFile(join(input.project.folderPath, rawContentPath), result.extractedText, "utf8");

      source.rawContentPath = rawContentPath;
      source.deepResearchStatus = "processed";
      addedClaims.push(...mapExtractedClaims(input.project, source, result.claims, existingClaims.length + addedClaims.length));
      mappedPoiCount += await mergeCandidatePoisAsync(geojson, result.pois);

      runs.push({
        sourceId: source.id,
        sourceUrl: source.url,
        status: "processed",
        extractedAt: new Date().toISOString(),
        rawContentPath,
        candidatePois: result.pois,
        candidateClaims: result.claims
      });
    } catch (error) {
      source.deepResearchStatus = "failed";
      runs.push({
        sourceId: source.id,
        sourceUrl: source.url,
        status: "failed",
        extractedAt: new Date().toISOString(),
        candidatePois: [],
        candidateClaims: [],
        error: error instanceof Error ? error.message : "Unknown deep research error."
      });
    }
  }

  const finalClaims = consolidateClaims(existingClaims, addedClaims);

  const report: DeepResearchReport = {
    projectId: input.project.id,
    processedSourceCount: runs.filter((run) => run.status === "processed").length,
    failedSourceCount: runs.filter((run) => run.status === "failed").length,
    addedClaimCount: finalClaims.length - existingClaims.length,
    candidatePoiCount: runs.reduce((sum, run) => sum + run.candidatePois.length, 0),
    mappedPoiCount,
    runs
  };

  await writeJsonFile(sourcesPath, sources);
  await writeJsonFile(claimsPath, finalClaims);
  await writeJsonFile(poiPath, geojson);
  await writeJsonFile(join(input.project.folderPath, "deep_research.json"), report);

  return report;
}

function consolidateClaims(existing: Claim[], newClaims: Claim[]): Claim[] {
  const all = [...existing];
  for (const nc of newClaims) {
    const ncLower = nc.claim.toLowerCase().trim();
    const match = all.find(c => {
      const cLower = c.claim.toLowerCase().trim();
      return cLower === ncLower || (cLower.includes(ncLower) && cLower.length < ncLower.length * 2) || (ncLower.includes(cLower) && ncLower.length < cLower.length * 2);
    });
    if (match) {
      match.sources = [...new Set([...match.sources, ...nc.sources])];
      if (match.sources.length >= 2 && match.status === "uncertain") {
        match.status = "likely";
        match.confidence = Math.max(match.confidence, 0.8);
      }
    } else {
      all.push(nc);
    }
  }
  return all;
}

async function readOptionalJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return await readJsonFile<T>(path);
  } catch {
    return fallback;
  }
}

function mapExtractedClaims(
  project: RouteProject,
  source: Source,
  claims: DeepResearchExtractionResult["claims"],
  offset: number
): Claim[] {
  return claims.map((claim, index) => ({
    id: `claim_${String(offset + index + 1).padStart(3, "0")}`,
    topicId: project.id,
    claim: claim.claim,
    claimType: normalizeClaimType(claim.type),
    confidence: clampConfidence(claim.confidence),
    status: claim.confidence >= 0.8 ? "likely" : "uncertain",
    sources: [source.id],
    needsHumanReview: false
  }));
}

function sameName(left: unknown, right: string | undefined): boolean {
  if (!left || !right) return false;
  return typeof left === "string" && left.trim().toLowerCase() === right.trim().toLowerCase();
}

function poiCandidateProperties(candidate: PoiCandidate) {
  return {
    description: candidate.description,
    type: candidate.type,
    contactPhone: candidate.contactPhone,
    contactEmail: candidate.contactEmail,
    website: candidate.website,
    priceRange: candidate.priceRange,
    openingHours: candidate.openingHours,
    waterAvailability: candidate.waterAvailability,
    facilities: candidate.facilities,
    placeId: (candidate as any).placeId,
    rating: (candidate as any).rating,
    userRatingCount: (candidate as any).userRatingCount,
    types: (candidate as any).types,
    verificationSource: (candidate as any).verificationSource || "deep_research"
  };
}

async function mergeCandidatePoisAsync(geojson: PoiFeatureCollection, candidates: PoiCandidate[]): Promise<number> {
  const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
  const googlePlaces = googleKey ? new GooglePlacesProvider(googleKey) : null;

  let mapped = 0;
  for (let candidate of candidates) {
    if (googlePlaces) {
      candidate = await googlePlaces.enrichPoi(candidate);
    }
    const matched = geojson.features.find((feature) => sameName(feature.properties?.name, candidate.name));
    if (matched) {
      matched.properties = { ...(matched.properties ?? {}), ...poiCandidateProperties(candidate), is_verified_by_deep_research: true };
      if (typeof candidate.lat === "number" && typeof candidate.lng === "number") {
        matched.geometry = { type: "Point", coordinates: [candidate.lng, candidate.lat] };
      }
      mapped += 1;
    } else if (typeof candidate.lat === "number" && typeof candidate.lng === "number") {
      geojson.features.push({
        type: "Feature",
        properties: {
          id: `poi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          name: candidate.name,
          ...poiCandidateProperties(candidate),
          is_verified_by_deep_research: true
        },
        geometry: { type: "Point", coordinates: [candidate.lng, candidate.lat] }
      });
      mapped += 1;
    }
  }
  return mapped;
}

function normalizeClaimType(value: string): Claim["claimType"] {
  if (["poi", "safety", "season", "distance", "difficulty", "logistics", "route_segment"].includes(value)) {
    return value as Claim["claimType"];
  }
  return "logistics";
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(value, 1));
}
