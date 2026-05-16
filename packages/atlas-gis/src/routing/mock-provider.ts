import type { RoutingProvider, RoutingProfile, RoutingResult, Waypoint } from './types.js';

export class MockRoutingProvider implements RoutingProvider {
  async getRoute(waypoints: Waypoint[], profile: RoutingProfile): Promise<RoutingResult> {
    if (waypoints.length < 2) {
      throw new Error('At least two waypoints are required to generate a route.');
    }

    // Mock logic: straight line between waypoints
    const points: Waypoint[] = [];
    let distanceKm = 0;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const start = waypoints[i];
      const end = waypoints[i + 1];
      
      points.push(start);
      
      // Calculate distance (very rough approximation for mock)
      const d = this.haversineDistance(start, end);
      distanceKm += d;
    }
    points.push(waypoints[waypoints.length - 1]);

    // Mock time estimation based on profile
    let speed = 10; // km/h
    if (profile === 'motorcycle') speed = 50;
    if (profile === 'bike') speed = 20;
    if (profile === 'hiking') speed = 4;

    const estimatedTimeH = distanceKm / speed;

    return {
      points,
      distanceKm: Math.round(distanceKm * 100) / 100,
      estimatedTimeH: Math.round(estimatedTimeH * 100) / 100,
      geometryGeoJson: {
        type: 'LineString',
        coordinates: points.map(p => [p.lng, p.lat])
      }
    };
  }

  private haversineDistance(p1: Waypoint, p2: Waypoint): number {
    const R = 6371; // km
    const dLat = (p2.lat - p1.lat) * (Math.PI / 180);
    const dLon = (p2.lng - p1.lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(p1.lat * (Math.PI / 180)) * Math.cos(p2.lat * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
