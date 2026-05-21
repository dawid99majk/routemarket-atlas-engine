import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { Poi, Recommendation, RouteProject, RouteTip, Claim } from "../../atlas-core/src/index.js";
import { readJsonFile } from "../../atlas-core/src/index.js";
import { getRouteMarketCategoryId } from "./category-mapping.js";
import type { PreparedRouteMarketDraft, RouteMarketDraftPayload } from "./types.js";
import { hashImportantArtifacts } from "../../atlas-workflow/src/artifact-hashes.js";
import { buildImportReadiness } from "../../atlas-workflow/src/import-readiness.js";

export async function prepareRouteMarketDraft(project: RouteProject): Promise<PreparedRouteMarketDraft> {
  const guidePath = join(project.folderPath, "guide.md");
  const routeSummaryPath = join(project.folderPath, "route_summary.json");
  const tipsPath = join(project.folderPath, "tips.json");
  const poisPath = join(project.folderPath, "poi.geojson");
  const recommendationsPath = join(project.folderPath, "recommendations.json");
  const mediaPath = join(project.folderPath, "media", "manifest.json");
  const gpxPath = join(project.folderPath, "route.gpx");
  const approvalsPath = join(project.folderPath, "approvals.json");

  const { checkQualityGates, QualityGateError } = await import("../../atlas-workflow/src/quality-gates.js");
  const issues = await checkQualityGates(project);
  if (issues.length > 0) {
    throw new QualityGateError(issues);
  }

  const claimsPath = join(project.folderPath, "claims.json");
  const claims = await readOptionalJson<Claim[]>(claimsPath, []);
  const allVerified = claims.length > 0 && claims.every(c => c.status === "verified" || c.id.startsWith("claim_tech_"));

  const description = await readOptionalText(guidePath);
  const routeSummary = await readOptionalJson<any>(routeSummaryPath);
  const tips = await readOptionalJson<RouteTip[]>(tipsPath, []);
  const pois = await readPoisFromGeoJson(poisPath);
  const recommendations = await readOptionalJson<Recommendation[]>(recommendationsPath, []);
  const mediaManifest = await readOptionalJson<any>(mediaPath, undefined);
  const sourceArtifactHashes = await hashImportantArtifacts(project);
  const generatedAt = new Date().toISOString();
  const payloadId = createHash("sha256")
    .update(`${project.slug}:${generatedAt}:${JSON.stringify(sourceArtifactHashes)}`)
    .digest("hex")
    .slice(0, 16);
  const payloadPath = join(project.folderPath, "routemarket_payload.json");
  const importReadiness = await buildImportReadiness({
    project,
    qualityIssues: issues,
    payloadPath
  });

  const draft: RouteMarketDraftPayload = {
    title: project.title,
    description,
    category_id: getRouteMarketCategoryId(project.category),
    currency: "PLN",
    price: 0,
    difficulty: normalizeDifficulty(routeSummary?.difficulty),
    distance_km: optionalNumber(routeSummary?.distanceKm),
    elevation_gain_m: optionalNumber(routeSummary?.elevationGainM),
    estimated_time_h: optionalNumber(routeSummary?.estimatedTimeH),
    location_string: project.region === "unknown" ? undefined : project.region,
    loop_type: normalizeLoopType(routeSummary?.loopType),
    risk_level: normalizeRisk(routeSummary?.riskLevel),
    season: optionalString(routeSummary?.season),
    start_point: optionalString(routeSummary?.startPoint),
    end_point: optionalString(routeSummary?.endPoint),
    surface_type: optionalString(routeSummary?.surfaceType),
    tags: [project.category, project.region, project.language].filter(Boolean),
    ai_assisted: true,
    is_verified: allVerified
  };

  const prepared: PreparedRouteMarketDraft = {
    contractVersion: "2.1",
    publishMode: "draft",
    canImportToRouteMarket: importReadiness.canImportToRouteMarket,
    payloadId,
    generatedAt,
    creationSource: "atlas_ai",
    atlasProjectSlug: project.slug,
    draftOnlyMode: true,
    importReadiness,
    importPolicy: {
      firstImportCreatesDraft: true,
      reimportUpdatesAtlasDraftOnly: true,
      requireExplicitConfirmationAfterManualEdit: true,
      importNeverPublishes: true,
      preserveManualMediaByDefault: true,
      preserveManualEditsByDefault: true,
      storeSourceArtifactHashes: true
    },
    sourceArtifactHashes,
    project,
    draft,
    routeSummary,
    guideText: description,
    tips,
    pois,
    recommendations,
    mediaManifest,
    claimsSummary: {
      total: claims.length,
      verified: claims.filter((claim) => claim.status === "verified").length,
      likely: claims.filter((claim) => claim.status === "likely").length,
      needsReview: claims.filter((claim) => claim.needsHumanReview || claim.status === "needs_creator_review" || claim.status === "uncertain").length
    },
    qualityGateResult: {
      passed: true,
      issues: []
    }
  };

  if (await exists(gpxPath)) {
    prepared.gpx = { path: gpxPath, attachMode: "gpx_xml" };
  }

  await writeFile(payloadPath, `${JSON.stringify(prepared, null, 2)}\n`, "utf8");
  return prepared;
}

export async function publishLiveDraft(prepared: PreparedRouteMarketDraft): Promise<{ success: boolean; remoteId?: number; message?: string }> {
  const apiUrl = process.env.ROUTEMARKET_API_URL;
  const apiToken = process.env.ROUTEMARKET_API_TOKEN;

  if (!apiUrl) {
    throw new Error("Missing ROUTEMARKET_API_URL environment variable.");
  }
  if (!apiToken) {
    throw new Error("Missing ROUTEMARKET_API_TOKEN environment variable.");
  }

  console.log(`Publishing payload ${prepared.payloadId} to ${apiUrl}...`);

  // Wrap payload for atlas-admin action: import_payload
  const body = {
    action: "import_payload",
    input: {
      payload: prepared
    }
  };

  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/functions/v1/atlas-admin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiToken}`,
      "apikey": apiToken,
      "X-Atlas-Payload-Id": prepared.payloadId
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`RouteMarket API error (${response.status}): ${errorBody}`);
  }

  const result = await response.json() as any;
  if (!result.ok && result.error) {
    throw new Error(`RouteMarket API processing error: ${result.error}`);
  }

  return {
    success: result.ok === true,
    remoteId: result.route?.id,
    message: result.reason || (result.imported ? "Successfully imported" : "Imported with issues")
  };
}

async function readPoisFromGeoJson(path: string): Promise<Poi[]> {
  const geojson = await readOptionalJson<{ features?: Array<Record<string, unknown>> }>(path, { features: [] });
  const pois: Poi[] = [];

  for (const [index, feature] of (geojson.features ?? []).entries()) {
      const geometry = feature.geometry as { coordinates?: number[] } | undefined;
      const props = (feature.properties ?? {}) as Record<string, unknown>;
      const coordinates = geometry?.coordinates;
      if (!coordinates || coordinates.length < 2 || !props.name) continue;
      const poi: Poi = {
        id: optionalString(props.id) ?? `poi_${String(index + 1).padStart(3, "0")}`,
        name: String(props.name),
        type: normalizePoiType(props.type),
        lat: Number(coordinates[1]),
        lng: Number(coordinates[0]),
        description: optionalString(props.description),
        funFact: optionalString(props.fun_fact ?? props.funFact),
        sortOrder: index,
        // Deep Research enhancements
        contactPhone: optionalString(props.contactPhone ?? props.contact_phone),
        contactEmail: optionalString(props.contactEmail ?? props.contact_email),
        website: optionalString(props.website),
        priceRange: optionalString(props.priceRange ?? props.price_range),
        openingHours: optionalString(props.openingHours ?? props.opening_hours),
        waterAvailability: ["unknown", "available", "seasonal", "none"].includes(String(props.waterAvailability ?? props.water_availability))
          ? (props.waterAvailability ?? props.water_availability) as Poi["waterAvailability"]
          : undefined,
        facilities: Array.isArray(props.facilities) ? props.facilities.map(String) : undefined,
        isVerifiedByDeepResearch: typeof props.isVerifiedByDeepResearch === "boolean" ? props.isVerifiedByDeepResearch : typeof props.is_verified_by_deep_research === "boolean" ? props.is_verified_by_deep_research : undefined,
        status: (props.status as any) || "confirmed"
      };
      pois.push(poi);
    }

  return pois;
}

async function readOptionalText(path: string): Promise<string | undefined> {
  return (await exists(path)) ? readFile(path, "utf8") : undefined;
}

async function readOptionalJson<T>(path: string, fallback?: T): Promise<T> {
  return (await exists(path)) ? readJsonFile<T>(path) : (fallback as T);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeDifficulty(value: unknown): RouteMarketDraftPayload["difficulty"] {
  return ["easy", "moderate", "hard", "expert"].includes(String(value)) ? (value as RouteMarketDraftPayload["difficulty"]) : undefined;
}

function normalizeLoopType(value: unknown): RouteMarketDraftPayload["loop_type"] {
  return ["loop", "out_and_back", "point_to_point"].includes(String(value)) ? (value as RouteMarketDraftPayload["loop_type"]) : undefined;
}

function normalizeRisk(value: unknown): RouteMarketDraftPayload["risk_level"] {
  return ["low", "medium", "high", "unknown"].includes(String(value)) ? (value as RouteMarketDraftPayload["risk_level"]) : "unknown";
}

function normalizePoiType(value: unknown): Poi["type"] {
  const normalized = String(value ?? "other");
  if (["viewpoint", "water", "food", "shelter", "landmark", "hazard", "other"].includes(normalized)) return normalized as Poi["type"];
  if (normalized === "restaurant") return "food";
  if (normalized === "hut") return "shelter";
  if (normalized === "warning") return "hazard";
  return "other";
}
