import * as Location from 'expo-location';
import { LocationCluster } from '../utils/clustering';
import { PlaceCategory, PlaceVisit } from '../types';

function inferCategoryFromPlaceName(name: string, street: string): PlaceCategory {
    const combined = `${name} ${street}`.toLowerCase();
    if (/park|trail|garden|lake|botanical|plaza/.test(combined)) return 'park_outdoors';
    if (/cafe|coffee|bakery|bistro|diner|restaurant|grill|kitchen/.test(combined)) return 'cafe_restaurant';
    if (/market|grocery|foods|supermarket|trader|kroger|walmart|target/.test(combined)) return 'grocery_store';
    if (/clinic|hospital|pharmacy|medical|health|dental|walgreens|cvs/.test(combined)) return 'medical_pharmacy';
    if (/library|center|church|club|museum|YMCA|senior/.test(combined)) return 'community_social';
    if (/bank|post|salon|barber|hardware|mall|shop/.test(combined)) return 'errand_retail';
    return 'unknown';
}

function getTimeOfDayLabel(timestamp: number): 'morning' | 'midday' | 'afternoon' | 'evening' {
    const hour = new Date(timestamp).getHours();
    if (hour < 11) return 'morning';
    if (hour < 14) return 'midday';
    if (hour < 17) return 'afternoon';
    return 'evening';
}

function buildAssumptionsAndHint(
    category: PlaceCategory,
    placeName: string,
    timeOfDay: 'morning' | 'midday' | 'afternoon' | 'evening',
    durationMinutes: number
): { assumptions: string[]; hint: string } {
    switch (category) {
        case 'cafe_restaurant':
            if (timeOfDay === 'morning') {
                return {
                    assumptions: [
                        `Had morning coffee or breakfast at ${placeName}`,
                        durationMinutes > 35 ? 'Likely sat down and chatted with a friend or read the news' : 'Picked up a quick morning drink or pastry',
                    ],
                    hint: `Think about where you went for a warm drink or bite to eat in the ${timeOfDay}.`,
                };
            }
            return {
                assumptions: [
                    `Stopped for a ${timeOfDay} meal or refreshment at ${placeName}`,
                    durationMinutes > 45 ? 'Enjoyed a sit-down meal with company' : 'Grabbed takeout or a quick snack',
                ],
                hint: `You spent ${durationMinutes} minutes enjoying food or refreshments during the ${timeOfDay}.`,
            };

        case 'grocery_store':
            return {
                assumptions: [
                    `Picked up groceries and household essentials at ${placeName}`,
                    durationMinutes > 25 ? 'Did a full weekly shopping trip down the aisles' : 'Stopped in for just a few fresh ingredients',
                ],
                hint: `You ran an errand to restock the kitchen in the ${timeOfDay}.`,
            };

        case 'park_outdoors':
            return {
                assumptions: [
                    `Spent ${durationMinutes} minutes outdoors at ${placeName}`,
                    'Likely went for a fresh-air walk, stretched your legs, or relaxed on a bench',
                ],
                hint: `You spent some time outside surrounded by nature in the ${timeOfDay}.`,
            };

        case 'medical_pharmacy':
            return {
                assumptions: [
                    `Visited ${placeName} for a wellness checkup or prescription pickup`,
                    durationMinutes > 20 ? 'Attended a scheduled health appointment' : 'Stopped by the pharmacy counter briefly',
                ],
                hint: `You took care of a health or pharmacy errand in the ${timeOfDay}.`,
            };

        case 'community_social':
            return {
                assumptions: [
                    `Participated in a community visit or social activity at ${placeName}`,
                    'Likely browsed books, attended a group gathering, or visited neighbors',
                ],
                hint: `You visited a local community spot for ${durationMinutes} minutes in the ${timeOfDay}.`,
            };

        default:
            return {
                assumptions: [
                    `Spent ${durationMinutes} minutes around ${placeName}`,
                    `Completed a ${timeOfDay} outing or personal visit nearby`,
                ],
                hint: `You made a ${durationMinutes}-minute stop at a neighborhood spot in the ${timeOfDay}.`,
            };
    }
}

export async function enrichClusterIntoVisit(
    cluster: LocationCluster,
    dateString: string,
    index: number
): Promise<PlaceVisit> {
    let placeName = 'Neighborhood Stop';
    let address = `${cluster.centerLatitude.toFixed(4)}, ${cluster.centerLongitude.toFixed(4)}`;

    try {
        const geocoded = await Location.reverseGeocodeAsync({
            latitude: cluster.centerLatitude,
            longitude: cluster.centerLongitude,
        });

        if (geocoded.length > 0) {
            const top = geocoded[0];
            placeName = top.name || top.street || 'Local Destination';
            address = [top.streetNumber, top.street, top.city].filter(Boolean).join(' ');
        }
    } catch {
        // Fallback cleanly when offline
    }

    const category = inferCategoryFromPlaceName(placeName, address);
    const timeOfDay = getTimeOfDayLabel(cluster.startTime);
    const { assumptions, hint } = buildAssumptionsAndHint(
        category,
        placeName,
        timeOfDay,
        cluster.durationMinutes
    );

    return {
        id: `${dateString}-visit-${index}-${cluster.startTime}`,
        dateString,
        placeName,
        address,
        category,
        latitude: cluster.centerLatitude,
        longitude: cluster.centerLongitude,
        startTime: cluster.startTime,
        endTime: cluster.endTime,
        durationMinutes: cluster.durationMinutes,
        assumedActivities: assumptions,
        cognitiveHint: hint,
    };
}