export type Waypoint = {
  lat: number;
  lng: number;
};

export type RoutingProfile = 'motorcycle' | 'bike' | 'hiking';

export type RoutingResult = {
  points: Waypoint[];
  distanceKm: number;
  estimatedTimeH: number;
  geometryGeoJson: {
    type: 'LineString';
    coordinates: number[][]; // [lng, lat][]
  };
};

export interface RoutingProvider {
  getRoute(waypoints: Waypoint[], profile: RoutingProfile): Promise<RoutingResult>;
}
