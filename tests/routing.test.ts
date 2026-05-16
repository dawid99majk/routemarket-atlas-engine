import { describe, it, expect } from 'vitest';
import { MockRoutingProvider } from '../packages/atlas-gis/src/index.js';

describe('Routing Module', () => {
  describe('MockRoutingProvider', () => {
    it('generates a mock route between two waypoints', async () => {
      const provider = new MockRoutingProvider();
      const waypoints = [
        { lat: 52.2297, lng: 21.0122 }, // Warsaw
        { lat: 50.0647, lng: 19.9450 }  // Krakow
      ];

      const result = await provider.getRoute(waypoints, 'motorcycle');

      expect(result.points).toHaveLength(2);
      expect(result.distanceKm).toBeGreaterThan(200);
      expect(result.distanceKm).toBeLessThan(400);
      expect(result.estimatedTimeH).toBeGreaterThan(0);
      expect(result.geometryGeoJson.type).toBe('LineString');
      expect(result.geometryGeoJson.coordinates).toHaveLength(2);
      expect(result.geometryGeoJson.coordinates[0]).toEqual([21.0122, 52.2297]);
    });

    it('calculates different estimated times for different profiles', async () => {
      const provider = new MockRoutingProvider();
      const waypoints = [
        { lat: 52.2297, lng: 21.0122 },
        { lat: 50.0647, lng: 19.9450 }
      ];

      const motorcycleResult = await provider.getRoute(waypoints, 'motorcycle');
      const hikingResult = await provider.getRoute(waypoints, 'hiking');

      expect(hikingResult.estimatedTimeH).toBeGreaterThan(motorcycleResult.estimatedTimeH);
    });

    it('throws error if less than 2 waypoints are provided', async () => {
      const provider = new MockRoutingProvider();
      const waypoints = [{ lat: 52.2297, lng: 21.0122 }];

      await expect(provider.getRoute(waypoints, 'bike')).rejects.toThrow('At least two waypoints are required');
    });
  });
});
