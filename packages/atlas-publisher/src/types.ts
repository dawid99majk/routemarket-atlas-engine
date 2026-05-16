import type { Poi, Recommendation, RouteProject, RouteSummary, RouteTip } from "../../atlas-core/src/index.js";

export type RouteMarketCreationSource = "manual" | "atlas_ai" | "manual_with_ai_suggestions";

export type RouteMarketDraftPayload = {
  title: string;
  description?: string;
  category_id?: number;
  currency: "PLN" | "EUR" | "USD";
  price: number;
  difficulty?: "easy" | "moderate" | "hard" | "expert";
  distance_km?: number;
  elevation_gain_m?: number;
  estimated_time_h?: number;
  location_string?: string;
  latitude?: number;
  longitude?: number;
  loop_type?: "loop" | "out_and_back" | "point_to_point";
  risk_level?: "low" | "medium" | "high" | "unknown";
  season?: string;
  start_point?: string;
  end_point?: string;
  subcategory?: string;
  surface_type?: string;
  tags?: string[];
  ai_assisted: boolean;
  is_verified?: boolean;
};

export type ImportReadinessState =
  | "not_started"
  | "collecting_inputs"
  | "ready_to_run_atlas"
  | "running"
  | "waiting_for_approval"
  | "changes_requested"
  | "blocked_by_missing_inputs"
  | "ready_to_import"
  | "imported_to_draft"
  | "import_conflict"
  | "failed";

export type RouteMarketImportReadiness = {
  state: ImportReadinessState;
  canImportToRouteMarket: boolean;
  blockingReasons: string[];
  warnings: string[];
  missingApprovals: string[];
  staleApprovals: string[];
  payloadPath: string;
  recommendedNextAction: string;
};

export type RouteMarketImportPolicy = {
  firstImportCreatesDraft: true;
  reimportUpdatesAtlasDraftOnly: true;
  requireExplicitConfirmationAfterManualEdit: true;
  importNeverPublishes: true;
  preserveManualMediaByDefault: true;
  preserveManualEditsByDefault: true;
  storeSourceArtifactHashes: true;
};

export type PreparedRouteMarketDraft = {
  contractVersion: "2.1";
  publishMode: "draft";
  canImportToRouteMarket: boolean;
  payloadId: string;
  generatedAt: string;
  creationSource: RouteMarketCreationSource;
  atlasProjectSlug: string;
  draftOnlyMode: true;
  importReadiness: RouteMarketImportReadiness;
  importPolicy: RouteMarketImportPolicy;
  sourceArtifactHashes: Record<string, string>;
  project: RouteProject;
  draft: RouteMarketDraftPayload;
  routeSummary?: RouteSummary;
  guideText?: string;
  tips: RouteTip[];
  pois: Poi[];
  recommendations: Recommendation[];
  mediaManifest?: unknown;
  claimsSummary: {
    total: number;
    verified: number;
    likely: number;
    needsReview: number;
  };
  qualityGateResult: {
    passed: boolean;
    issues: Array<{ rule: string; message: string }>;
  };
  gpx?: {
    path: string;
    attachMode: "gpx_xml";
  };
};
