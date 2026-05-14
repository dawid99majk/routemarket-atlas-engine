import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Claim, RouteProject, Source } from "../../../atlas-core/src/index.js";
import { readJsonFile, writeJsonFile } from "../../../atlas-core/src/index.js";
import { MockDeepResearchProvider } from "../mock/mock-deep-research-provider.js";
import type { DeepResearchExtractionResult, DeepResearchProvider, PoiCandidate } from "../providers/interfaces.js";

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
  geometry?: {
    type?: string;
    coordinates?: number[];
  };
};

type PoiFeatureCollection = {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
};

export async function runDeepResearch(input: RunDeepResearchInput): Promise<DeepResearchReport> {
  const provider = input.provider ?? new MockDeepResearchProvider();
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
      mappedPoiCount += mergeCandidatePois(geojson, result.pois);

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

  const report: DeepResearchReport = {
    projectId: input.project.id,
    processedSourceCount: runs.filter((run) => run.status === "processed").length,
    failedSourceCount: runs.filter((run) => run.status === "failed").length,
    addedClaimCount: addedClaims.length,
    candidatePoiCount: runs.reduce((sum, run) => sum + run.candidatePois.length, 0),
    mappedPoiCount,
    runs
  };

  await writeJsonFile(sourcesPath, sources);
  await writeJsonFile(claimsPath, [...existingClaims, ...addedClaims]);
  await writeJsonFile(poiPath, geojson);
  await writeJsonFile(join(input.project.folderPath, "deep_research.json"), report);

  return report;
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
    sources: [source.id]
  }));
}

function mergeCandidatePois(geojson: PoiFeatureCollection, candidates: PoiCandidate[]): number {
  let mapped = 0;
  for (const candidate of candidates) {
    const matched = geojson.features.find((feature) => sameName(feature.properties?.name, candidate.name));
    if (matched) {
      matched.properties = { ...(matched.properties ?? {}), ...poiCandidateProperties(candidate), is_verified_by_deep_research: true };
      mapped += 1;
      continue;
    }

    if (typeof candidate.lat === "number" && typeof candidate.lng === "number") {
      geojson.features.push({
        type: "Feature",
        properties: {
          id: `poi_${String(geojson.features.length + 1).padStart(3, "0")}`,
          ...poiCandidateProperties(candidate)
        },
        geometry: {
          type: "Point",
          coordinates: [candidate.lng, candidate.lat]
        }
      });
      mapped += 1;
    }
  }
  return mapped;
}

function poiCandidateProperties(candidate: PoiCandidate): Record<string, unknown> {
  return {
    name: candidate.name,
    type: candidate.type,
    description: candidate.description,
    contact_phone: candidate.contactPhone,
    contact_email: candidate.contactEmail,
    website: candidate.website,
    price_range: candidate.priceRange,
    opening_hours: candidate.openingHours,
    water_availability: candidate.waterAvailability,
    facilities: candidate.facilities,
    is_verified_by_deep_research: candidate.isVerifiedByDeepResearch
  };
}

function sameName(left: unknown, right: string): boolean {
  return typeof left === "string" && left.trim().toLowerCase() === right.trim().toLowerCase();
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
