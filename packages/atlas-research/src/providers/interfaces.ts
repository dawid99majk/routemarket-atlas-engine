import type { Source, SourceType } from "../../../atlas-core/src/models/source.js";

export type SearchInput = {
  query: string;
  category: string;
  region: string;
  language: string;
  limit?: number;
};

export type SourceCandidate = Omit<Source, "id" | "topicId" | "dateFound"> & {
  sourceType: SourceType;
};

export type PoiCandidate = {
  name: string;
  type: "viewpoint" | "water" | "food" | "shelter" | "landmark" | "hazard" | "other";
  lat?: number;
  lng?: number;
  description?: string;
  contactPhone?: string;
  contactEmail?: string;
  website?: string;
  priceRange?: string;
  openingHours?: string;
  waterAvailability?: "unknown" | "available" | "seasonal" | "none";
  facilities?: string[];
  isVerifiedByDeepResearch?: boolean;
};

export type MapSearchInput = {
  query: string;
  region: string;
  category: string;
};

export type RouteBuildInput = {
  projectId: string;
  start?: string;
  finish?: string;
  waypoints?: string[];
};

export type RouteDraft = {
  distanceKm?: number;
  elevationGainM?: number;
  gpxXml?: string;
  geojson?: unknown;
};

export type BriefInput = {
  title: string;
  category: string;
  region: string;
  language: string;
  sources?: Source[];
};

export type PublishDraftInput = {
  projectId: string;
  routeMarketRouteId?: number;
};

export type PublishResult = {
  routeMarketRouteId: number;
  status: "draft" | "published";
};

export interface SearchProvider {
  search(input: SearchInput): Promise<SourceCandidate[]>;
}

export interface VideoProvider {
  searchVideos(input: SearchInput): Promise<SourceCandidate[]>;
}

export interface ForumProvider {
  searchDiscussions(input: SearchInput): Promise<SourceCandidate[]>;
}

export interface MapProvider {
  findPlaces(input: MapSearchInput): Promise<PoiCandidate[]>;
}

export interface RouteProvider {
  buildRoute(input: RouteBuildInput): Promise<RouteDraft>;
}

export interface WriterProvider {
  generateBrief(input: BriefInput): Promise<string>;
}

export interface PublisherProvider {
  publishDraft(input: PublishDraftInput): Promise<PublishResult>;
}

export type DeepResearchExtractionResult = {
  pois: PoiCandidate[];
  claims: { claim: string; type: string; confidence: number }[];
  extractedText: string;
};

export interface DeepResearchProvider {
  scrapeAndExtract(sourceUrl: string, topicContext: string): Promise<DeepResearchExtractionResult>;
}
