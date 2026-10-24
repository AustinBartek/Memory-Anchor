import { RawLocationPoint } from '../types';

export interface LocationCluster {
    centerLatitude: number;
    centerLongitude: number;
    startTime: number;
    endTime: number;
    durationMinutes: number;
    pointCount: number;
}

const EARTH_RADIUS_METERS = 6371000;

export function getDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_METERS * c;
}

/**
 * Groups sequential 30s location pings into meaningful stationary stops.
 * @param points Chronologically ordered GPS points for a single day
 * @param radiusMeters Max distance from cluster centroid (default 50m)
 * @param minDwellMinutes Minimum time spent at a location to count as a visit (default 5 mins)
 */
export function extractSignificantStops(
    points: RawLocationPoint[],
    radiusMeters = 50,
    minDwellMinutes = 5
): LocationCluster[] {
    if (points.length === 0) return [];

    const clusters: LocationCluster[] = [];
    let currentGroup: RawLocationPoint[] = [points[0]];

    const finalizeGroup = (group: RawLocationPoint[]) => {
        const startTime = group[0].timestamp;
        const endTime = group[group.length - 1].timestamp;
        const durationMinutes = Math.round((endTime - startTime) / 60000);

        if (durationMinutes >= minDwellMinutes) {
            const avgLat = group.reduce((sum, p) => sum + p.latitude, 0) / group.length;
            const avgLon = group.reduce((sum, p) => sum + p.longitude, 0) / group.length;
            clusters.push({
                centerLatitude: avgLat,
                centerLongitude: avgLon,
                startTime,
                endTime,
                durationMinutes,
                pointCount: group.length,
            });
        }
    };

    for (let i = 1; i < points.length; i++) {
        const candidate = points[i];
        const anchor = currentGroup[0];
        const dist = getDistanceMeters(
            anchor.latitude,
            anchor.longitude,
            candidate.latitude,
            candidate.longitude
        );

        if (dist <= radiusMeters) {
            currentGroup.push(candidate);
        } else {
            finalizeGroup(currentGroup);
            currentGroup = [candidate];
        }
    }

    finalizeGroup(currentGroup);
    return clusters;
}