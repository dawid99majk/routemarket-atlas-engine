import type { Poi, Recommendation, RouteProject, RouteTip } from "../../atlas-core/src/index.js";

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

export type PreparedRouteMarketDraft = {
  project: RouteProject;
  draft: RouteMarketDraftPayload;
  tips: RouteTip[];
  pois: Poi[];
  recommendations: Recommendation[];
  gpx?: {
    path: string;
    attachMode: "gpx_xml";
  };
};
