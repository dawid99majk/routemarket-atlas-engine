import type { RoutingProvider, RoutingProfile, RoutingResult, Waypoint } from './types.js';

export class GraphHopperRoutingProvider implements RoutingProvider {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://graphhopper.com/api/1/route';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GRAPHHOPPER_API_KEY || '';
  }

  async getRoute(waypoints: Waypoint[], profile: RoutingProfile): Promise<RoutingResult> {
    if (!this.apiKey) {
      throw new Error('GraphHopper API key is missing. Please provide it in constructor or set GRAPHHOPPER_API_KEY env variable.');
    }

    if (waypoints.length < 2) {
      throw new Error('At least two waypoints are required to generate a route.');
    }

    const ghProfile = this.mapProfile(profile);
    
    const url = new URL(this.baseUrl);
    url.searchParams.set('key', this.apiKey);

    const body = {
      points: waypoints.map(w => [w.lng, w.lat]),
      profile: ghProfile,
      locale: 'en',
      points_encoded: false,
      instructions: false,
      elevation: true
    };

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GraphHopper API error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as any;
    
    if (!data.paths || data.paths.length === 0) {
      throw new Error('GraphHopper returned no paths for the given waypoints.');
    }

    const path = data.paths[0];
    const coordinates = path.points.coordinates as number[][];
    
    const resultPoints: Waypoint[] = coordinates.map(coord => ({
      lng: coord[0],
      lat: coord[1]
    }));

    return {
      points: resultPoints,
      distanceKm: Math.round((path.distance / 1000) * 100) / 100,
      estimatedTimeH: Math.round((path.time / 3600000) * 100) / 100,
      geometryGeoJson: {
        type: 'LineString',
        coordinates: coordinates
      }
    };
  }

  private mapProfile(profile: RoutingProfile): string {
    switch (profile) {
      case 'motorcycle': return 'car';
      case 'bike': return 'bike';
      case 'hiking': return 'foot';
      default: return 'foot';
    }
  }
}
