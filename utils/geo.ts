import { Coordinate } from '../types';

/**
 * Calculates the distance between two coordinates in meters using the Haversine formula.
 */
export const haversineMeters = (a: Coordinate | null | undefined, b: Coordinate | null | undefined): number => {
  if (!a || !b || a.lat === undefined || a.lng === undefined || b.lat === undefined || b.lng === undefined) {
    return 0;
  }
  
  const R = 6371000; // Radius of the Earth in meters
  const toRad = (d: number) => (d * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(x));
};

/**
 * Checks if a user is within the unlock radius of a point.
 */
export const isWithinRadius = (userPos: Coordinate | null | undefined, targetPos: Coordinate | null | undefined, radius: number): boolean => {
  if (!userPos || !targetPos) return false;
  const distance = haversineMeters(userPos, targetPos);
  return distance <= radius;
};

/**
 * Formats distance for display (m or km).
 */
export const formatDistance = (meters: number): string => {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
};

/**
 * Validates if a coordinate is valid (has both lat/lng as finite numbers).
 * Replaces the problematic {lat: 0, lng: 0} sentinel pattern.
 */
export const isValidCoordinate = (coord: any): coord is Coordinate => {
  return (
    coord &&
    typeof coord === 'object' &&
    Number.isFinite(coord.lat) &&
    Number.isFinite(coord.lng)
  );
};

/**
 * Normalizes a coordinate to ensure it has finite lat/lng values.
 * Returns null if coordinate is invalid.
 */
export const normalizeCoordinate = (coord: any): Coordinate | null => {
  if (!isValidCoordinate(coord)) {
    return null;
  }
  return {
    lat: Number(coord.lat),
    lng: Number(coord.lng)
  };
};
