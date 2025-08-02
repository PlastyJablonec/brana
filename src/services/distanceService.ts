// Service for calculating distances between geographic coordinates

export interface ICoordinates {
  latitude: number;
  longitude: number;
}

class DistanceService {
  /**
   * Calculate distance between two coordinates using Haversine formula
   * @param coord1 First coordinate
   * @param coord2 Second coordinate
   * @returns Distance in meters
   */
  calculateDistance(coord1: ICoordinates, coord2: ICoordinates): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (coord1.latitude * Math.PI) / 180; // φ, λ in radians
    const φ2 = (coord2.latitude * Math.PI) / 180;
    const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c; // Distance in meters
    return distance;
  }

  /**
   * Check if user is within allowed distance from gate
   * @param userLocation User's current location
   * @param gateLocation Gate location
   * @param maxDistanceMeters Maximum allowed distance in meters
   * @returns true if user is within allowed distance
   */
  isWithinAllowedDistance(
    userLocation: ICoordinates,
    gateLocation: ICoordinates,
    maxDistanceMeters: number
  ): boolean {
    const distance = this.calculateDistance(userLocation, gateLocation);
    return distance <= maxDistanceMeters;
  }

  /**
   * Format distance for display
   * @param distanceMeters Distance in meters
   * @returns Formatted distance string
   */
  formatDistance(distanceMeters: number): string {
    if (distanceMeters < 1000) {
      return `${Math.round(distanceMeters)} m`;
    } else {
      return `${(distanceMeters / 1000).toFixed(1)} km`;
    }
  }
}

export const distanceService = new DistanceService();