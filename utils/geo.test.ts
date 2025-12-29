import { haversineMeters, isValidCoordinate, normalizeCoordinate, isWithinRadius, formatDistance } from './geo';
import { Coordinate } from '../types';

describe('haversineMeters', () => {
  describe('Success scenarios', () => {
    it('should calculate distance between two valid coordinates', () => {
      const pointA: Coordinate = { lat: 55.6761, lng: 12.5683 }; // Copenhagen
      const pointB: Coordinate = { lat: 55.6868, lng: 12.5700 }; // ~1.2km north

      const distance = haversineMeters(pointA, pointB);

      // Should be approximately 1190 meters (allow 10m tolerance)
      expect(distance).toBeGreaterThan(1180);
      expect(distance).toBeLessThan(1200);
    });

    it('should return 0 for identical coordinates', () => {
      const point: Coordinate = { lat: 55.6761, lng: 12.5683 };

      const distance = haversineMeters(point, point);

      expect(distance).toBe(0);
    });

    it('should calculate small distances accurately', () => {
      const pointA: Coordinate = { lat: 55.6761, lng: 12.5683 };
      const pointB: Coordinate = { lat: 55.6762, lng: 12.5684 }; // ~100m away

      const distance = haversineMeters(pointA, pointB);

      // Very short distance
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(200);
    });

    it('should calculate long distances accurately', () => {
      const copenhagen: Coordinate = { lat: 55.6761, lng: 12.5683 };
      const london: Coordinate = { lat: 51.5074, lng: -0.1278 }; // ~900km

      const distance = haversineMeters(copenhagen, london);

      // Should be approximately 955,000 meters (955km)
      expect(distance).toBeGreaterThan(850000);
      expect(distance).toBeLessThan(960000);
    });

    it('should handle coordinates across the equator', () => {
      const northHemisphere: Coordinate = { lat: 10.0, lng: 0.0 };
      const southHemisphere: Coordinate = { lat: -10.0, lng: 0.0 };

      const distance = haversineMeters(northHemisphere, southHemisphere);

      // Approximately 20 degrees of latitude = ~2,222 km
      expect(distance).toBeGreaterThan(2200000);
      expect(distance).toBeLessThan(2250000);
    });

    it('should handle coordinates across the prime meridian', () => {
      const west: Coordinate = { lat: 0.0, lng: -10.0 };
      const east: Coordinate = { lat: 0.0, lng: 10.0 };

      const distance = haversineMeters(west, east);

      // Should calculate correct distance across meridian
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(3000000);
    });
  });

  describe('Failure scenarios', () => {
    it('should return 0 when first coordinate is null', () => {
      const validPoint: Coordinate = { lat: 55.6761, lng: 12.5683 };

      const distance = haversineMeters(null, validPoint);

      expect(distance).toBe(0);
    });

    it('should return 0 when second coordinate is null', () => {
      const validPoint: Coordinate = { lat: 55.6761, lng: 12.5683 };

      const distance = haversineMeters(validPoint, null);

      expect(distance).toBe(0);
    });

    it('should return 0 when both coordinates are null', () => {
      const distance = haversineMeters(null, null);

      expect(distance).toBe(0);
    });

    it('should return 0 when first coordinate is undefined', () => {
      const validPoint: Coordinate = { lat: 55.6761, lng: 12.5683 };

      const distance = haversineMeters(undefined, validPoint);

      expect(distance).toBe(0);
    });

    it('should return 0 when second coordinate is undefined', () => {
      const validPoint: Coordinate = { lat: 55.6761, lng: 12.5683 };

      const distance = haversineMeters(validPoint, undefined);

      expect(distance).toBe(0);
    });

    it('should return 0 when coordinate has NaN latitude', () => {
      const validPoint: Coordinate = { lat: 55.6761, lng: 12.5683 };
      const invalidPoint: any = { lat: NaN, lng: 12.5683 };

      const distance = haversineMeters(validPoint, invalidPoint);

      expect(distance).toBe(0);
    });

    it('should return 0 when coordinate has NaN longitude', () => {
      const validPoint: Coordinate = { lat: 55.6761, lng: 12.5683 };
      const invalidPoint: any = { lat: 55.6761, lng: NaN };

      const distance = haversineMeters(validPoint, invalidPoint);

      expect(distance).toBe(0);
    });

    it('should return 0 when coordinate has Infinity latitude', () => {
      const validPoint: Coordinate = { lat: 55.6761, lng: 12.5683 };
      const invalidPoint: any = { lat: Infinity, lng: 12.5683 };

      const distance = haversineMeters(validPoint, invalidPoint);

      expect(distance).toBe(0);
    });

    it('should return 0 when coordinate has -Infinity longitude', () => {
      const validPoint: Coordinate = { lat: 55.6761, lng: 12.5683 };
      const invalidPoint: any = { lat: 55.6761, lng: -Infinity };

      const distance = haversineMeters(validPoint, invalidPoint);

      expect(distance).toBe(0);
    });

    it('should return 0 when coordinate is missing lat property', () => {
      const validPoint: Coordinate = { lat: 55.6761, lng: 12.5683 };
      const invalidPoint: any = { lng: 12.5683 };

      const distance = haversineMeters(validPoint, invalidPoint);

      expect(distance).toBe(0);
    });

    it('should return 0 when coordinate is missing lng property', () => {
      const validPoint: Coordinate = { lat: 55.6761, lng: 12.5683 };
      const invalidPoint: any = { lat: 55.6761 };

      const distance = haversineMeters(validPoint, invalidPoint);

      expect(distance).toBe(0);
    });

    it('should return 0 when coordinate is an empty object', () => {
      const validPoint: Coordinate = { lat: 55.6761, lng: 12.5683 };
      const invalidPoint: any = {};

      const distance = haversineMeters(validPoint, invalidPoint);

      expect(distance).toBe(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle very small decimal differences', () => {
      const pointA: Coordinate = { lat: 55.6761000001, lng: 12.5683000001 };
      const pointB: Coordinate = { lat: 55.6761000002, lng: 12.5683000002 };

      const distance = haversineMeters(pointA, pointB);

      // Extremely small distance, but should still be calculated
      expect(distance).toBeGreaterThanOrEqual(0);
      expect(distance).toBeLessThan(1);
    });

    it('should handle coordinates at the North Pole', () => {
      const northPole: Coordinate = { lat: 90, lng: 0 };
      const nearNorthPole: Coordinate = { lat: 89, lng: 0 };

      const distance = haversineMeters(northPole, nearNorthPole);

      // Approximately 111 km (1 degree of latitude)
      expect(distance).toBeGreaterThan(110000);
      expect(distance).toBeLessThan(112000);
    });

    it('should handle coordinates at the South Pole', () => {
      const southPole: Coordinate = { lat: -90, lng: 0 };
      const nearSouthPole: Coordinate = { lat: -89, lng: 0 };

      const distance = haversineMeters(southPole, nearSouthPole);

      // Approximately 111 km (1 degree of latitude)
      expect(distance).toBeGreaterThan(110000);
      expect(distance).toBeLessThan(112000);
    });

    it('should handle coordinates with negative latitude and longitude', () => {
      const pointA: Coordinate = { lat: -33.8688, lng: 151.2093 }; // Sydney
      const pointB: Coordinate = { lat: -37.8136, lng: 144.9631 }; // Melbourne

      const distance = haversineMeters(pointA, pointB);

      // Approximately 714 km
      expect(distance).toBeGreaterThan(700000);
      expect(distance).toBeLessThan(730000);
    });
  });
});

describe('isValidCoordinate', () => {
  it('should return true for valid coordinate', () => {
    const coord: Coordinate = { lat: 55.6761, lng: 12.5683 };
    expect(isValidCoordinate(coord)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isValidCoordinate(null)).toBeFalsy();
  });

  it('should return false for undefined', () => {
    expect(isValidCoordinate(undefined)).toBeFalsy();
  });

  it('should return false for NaN latitude', () => {
    const coord: any = { lat: NaN, lng: 12.5683 };
    expect(isValidCoordinate(coord)).toBe(false);
  });

  it('should return false for missing lat', () => {
    const coord: any = { lng: 12.5683 };
    expect(isValidCoordinate(coord)).toBe(false);
  });
});

describe('normalizeCoordinate', () => {
  it('should normalize valid coordinate', () => {
    const coord: Coordinate = { lat: 55.6761, lng: 12.5683 };
    const result = normalizeCoordinate(coord);

    expect(result).toEqual({ lat: 55.6761, lng: 12.5683 });
  });

  it('should return null for invalid coordinate', () => {
    const coord: any = { lat: NaN, lng: 12.5683 };
    expect(normalizeCoordinate(coord)).toBeNull();
  });
});

describe('isWithinRadius', () => {
  it('should return true when within radius', () => {
    const pointA: Coordinate = { lat: 55.6761, lng: 12.5683 };
    const pointB: Coordinate = { lat: 55.6762, lng: 12.5684 };
    
    expect(isWithinRadius(pointA, pointB, 200)).toBe(true);
  });

  it('should return false when outside radius', () => {
    const pointA: Coordinate = { lat: 55.6761, lng: 12.5683 };
    const pointB: Coordinate = { lat: 55.6868, lng: 12.5700 };
    
    expect(isWithinRadius(pointA, pointB, 100)).toBe(false);
  });
});

describe('formatDistance', () => {
  it('should format meters when less than 1000', () => {
    expect(formatDistance(500)).toBe('500 m');
  });

  it('should format kilometers when 1000 or more', () => {
    expect(formatDistance(1500)).toBe('1.5 km');
  });

  it('should round meters', () => {
    expect(formatDistance(123.7)).toBe('124 m');
  });
});
