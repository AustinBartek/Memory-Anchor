import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import {
    insertRawLocation,
    getRawLocationsByDate,
    savePlaceVisit,
    getPlaceVisitsByDate,
    saveRecallSummary,
} from '../db/database';
import { extractSignificantStops } from '../utils/clustering';
import { enrichClusterIntoVisit } from './activityInference';
import { DailyRecallSummary, PlaceVisit } from '../types';

export const BACKGROUND_LOCATION_TASK = 'MEMORY_ANCHOR_30S_LOCATION_TASK';

/**
 * Returns a YYYY-MM-DD date string for `daysAgo` days before today (0 = today, 1 = yesterday, etc.).
 */
export function getDateStringDaysAgo(daysAgo: number): string {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
}

export function getTodayDateString(): string {
    return getDateStringDaysAgo(0);
}

export function getYesterdayDateString(): string {
    return getDateStringDaysAgo(1);
}

// Register top-level background task handler
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
        console.error('Background location error:', error.message);
        return;
    }
    if (data) {
        const { locations } = data as { locations: Location.LocationObject[] };
        const dateString = getTodayDateString();
        for (const loc of locations) {
            await insertRawLocation({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                timestamp: loc.timestamp,
                dateString,
            });
        }
    }
});

export async function start30SecondTracking(): Promise<boolean> {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return false;

    if (Platform.OS !== 'web') {
        const bg = await Location.requestBackgroundPermissionsAsync();
        if (bg.status === 'granted') {
            const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
            if (!isRegistered) {
                await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
                    accuracy: Location.Accuracy.Balanced,
                    timeInterval: 30000, // 30 seconds
                    distanceInterval: 15, // Minimum 15m displacement to conserve battery
                    showsBackgroundLocationIndicator: true,
                    foregroundService: {
                        notificationTitle: 'Memory Anchor Active',
                        notificationBody: 'Gently remembering your stops for tonight’s reflection.',
                        notificationColor: '#1E3A8A',
                    },
                });
            }
            return true;
        }
    }
    return true;
}

export async function stop30SecondTracking(): Promise<void> {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    if (isRegistered) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
}

export async function compileTodayTimeline(): Promise<PlaceVisit[]> {
    const today = getTodayDateString();
    const rawPoints = await getRawLocationsByDate(today);
    const clusters = extractSignificantStops(rawPoints, 50, 5);

    for (let i = 0; i < clusters.length; i++) {
        const visit = await enrichClusterIntoVisit(clusters[i], today, i);
        await savePlaceVisit(visit);
    }

    return await getPlaceVisitsByDate(today);
}

/**
 * Hackathon Demo Helper: Seeds realistic PlaceVisits and DailyRecallSummaries for
 * Today AND the 3 previous days so judges can test both tonight's Evening Recall flow
 * and multi-day Calendar / SingleDay navigation immediately.
 */
export async function seedDemoDayForHackathon(): Promise<PlaceVisit[]> {
    const hourMs = 3600 * 1000;

    const todayStr = getDateStringDaysAgo(0);
    const oneDayAgoStr = getDateStringDaysAgo(1);
    const twoDaysAgoStr = getDateStringDaysAgo(2);
    const threeDaysAgoStr = getDateStringDaysAgo(3);

    const eveningAnchor = (dateStr: string) =>
        new Date(`${dateStr}T17:00:00`).getTime();

    // ---------------------------------------------------------------------------
    // 1. TODAY (0 days ago): Unfinished recall so judges can test the Hint toggles
    // ---------------------------------------------------------------------------
    const todayEvening = eveningAnchor(todayStr);
    const todayVisits: PlaceVisit[] = [
        {
            id: `${todayStr}-demo-1`,
            dateString: todayStr,
            placeName: 'Sunrise Corner Bakery & Cafe',
            address: '214 Main Street',
            category: 'cafe_restaurant',
            latitude: 35.2226,
            longitude: -97.4395,
            startTime: todayEvening - 8 * hourMs,   // 9:00 AM
            endTime: todayEvening - 7.2 * hourMs,   // 9:48 AM
            durationMinutes: 48,
            assumedActivities: [
                'Had morning coffee or breakfast at Sunrise Corner Bakery & Cafe',
                'Likely sat down and chatted with a friend or read the morning paper',
            ],
            cognitiveHint: 'Think about where you went for a warm drink and pastry this morning.',
            recalledIndependently: false,
        },
        {
            id: `${todayStr}-demo-2`,
            dateString: todayStr,
            placeName: 'Andrews Botanical Park',
            address: '401 Park Blvd',
            category: 'park_outdoors',
            latitude: 35.2285,
            longitude: -97.4452,
            startTime: todayEvening - 5.5 * hourMs, // 11:30 AM
            endTime: todayEvening - 4.75 * hourMs,  // 12:15 PM
            durationMinutes: 45,
            assumedActivities: [
                'Spent 45 minutes outdoors at Andrews Botanical Park',
                'Likely took a late-morning walk along the paved garden trail',
            ],
            cognitiveHint: 'You spent about 45 minutes outdoors surrounded by trees before lunch.',
            recalledIndependently: false,
        },
        {
            id: `${todayStr}-demo-3`,
            dateString: todayStr,
            placeName: 'Crest Fresh Market',
            address: '1420 Alameda St',
            category: 'grocery_store',
            latitude: 35.2189,
            longitude: -97.4241,
            startTime: todayEvening - 2.5 * hourMs, // 2:30 PM
            endTime: todayEvening - 1.9 * hourMs,   // 3:06 PM
            durationMinutes: 36,
            assumedActivities: [
                'Picked up groceries and household essentials at Crest Fresh Market',
                'Did a mid-afternoon shopping trip for fresh produce and dinner items',
            ],
            cognitiveHint: 'You ran an afternoon errand to restock groceries for the kitchen.',
            recalledIndependently: false,
        },
    ];

    for (const visit of todayVisits) {
        await savePlaceVisit(visit);
    }

    // ---------------------------------------------------------------------------
    // 2. YESTERDAY (1 day ago): Completed recall summary with 3 stops (100% score)
    // ---------------------------------------------------------------------------
    const day1Evening = eveningAnchor(oneDayAgoStr);
    const day1Visits: PlaceVisit[] = [
        {
            id: `${oneDayAgoStr}-demo-1`,
            dateString: oneDayAgoStr,
            placeName: 'Pioneer Public Library',
            address: '300 Norman Center Ct',
            category: 'community_social',
            latitude: 35.2241,
            longitude: -97.4422,
            startTime: day1Evening - 7 * hourMs,    // 10:00 AM
            endTime: day1Evening - 5.8 * hourMs,    // 11:12 AM
            durationMinutes: 72,
            assumedActivities: [
                'Participated in a community visit or browsed books at Pioneer Public Library',
                'Spent over an hour in a quiet reading area or book club meeting',
            ],
            cognitiveHint: 'You spent over an hour browsing books or reading in a quiet community building.',
            userRecalledNote: 'Picked up two mystery novels and talked with the librarian about local history.',
            recalledIndependently: true,
        },
        {
            id: `${oneDayAgoStr}-demo-2`,
            dateString: oneDayAgoStr,
            placeName: 'Neighborhood Bistro & Grill',
            address: '318 Campus Corner Dr',
            category: 'cafe_restaurant',
            latitude: 35.2112,
            longitude: -97.4398,
            startTime: day1Evening - 4.5 * hourMs,  // 12:30 PM
            endTime: day1Evening - 3.5 * hourMs,    // 1:30 PM
            durationMinutes: 60,
            assumedActivities: [
                'Stopped for a midday meal at Neighborhood Bistro & Grill',
                'Enjoyed a sit-down lunch with company',
            ],
            cognitiveHint: 'You had a 1-hour sit-down lunch around 12:30 PM.',
            userRecalledNote: 'Had tomato soup and a grilled cheese sandwich with Sarah.',
            recalledIndependently: true,
        },
        {
            id: `${oneDayAgoStr}-demo-3`,
            dateString: oneDayAgoStr,
            placeName: 'Sooner Care Pharmacy',
            address: '800 West Main St',
            category: 'medical_pharmacy',
            latitude: 35.2219,
            longitude: -97.4511,
            startTime: day1Evening - 2 * hourMs,    // 3:00 PM
            endTime: day1Evening - 1.65 * hourMs,   // 3:21 PM
            durationMinutes: 21,
            assumedActivities: [
                'Visited Sooner Care Pharmacy for a prescription pickup or wellness item',
                'Stopped by the pharmacy counter briefly in the afternoon',
            ],
            cognitiveHint: 'You made a quick 20-minute health or pharmacy stop in the afternoon.',
            userRecalledNote: 'Picked up my weekly vitamin refills.',
            recalledIndependently: true,
        },
    ];

    await saveRecallSummary({
        dateString: oneDayAgoStr,
        visits: day1Visits,
        freeRecallText: 'Went to the library in the morning, had lunch with Sarah, and stopped by the pharmacy.',
        completedAt: day1Evening + 2.5 * hourMs,
        recallScorePercent: 100,
    });

    // ---------------------------------------------------------------------------
    // 3. TWO DAYS AGO (2 days ago): Completed recall summary with 2 stops (50% score)
    // ---------------------------------------------------------------------------
    const day2Evening = eveningAnchor(twoDaysAgoStr);
    const day2Visits: PlaceVisit[] = [
        {
            id: `${twoDaysAgoStr}-demo-1`,
            dateString: twoDaysAgoStr,
            placeName: 'Legacy Trailhead Park',
            address: '105 Duffy Street',
            category: 'park_outdoors',
            latitude: 35.2175,
            longitude: -97.4361,
            startTime: day2Evening - 7.5 * hourMs,  // 9:30 AM
            endTime: day2Evening - 6.75 * hourMs,   // 10:15 AM
            durationMinutes: 45,
            assumedActivities: [
                'Spent 45 minutes outdoors at Legacy Trailhead Park',
                'Likely went for a morning walk and watched the birds',
            ],
            cognitiveHint: 'You went for a 45-minute morning walk outdoors.',
            userRecalledNote: 'Saw a cardinal near the walking bridge; the weather was crisp and clear.',
            recalledIndependently: true,
        },
        {
            id: `${twoDaysAgoStr}-demo-2`,
            dateString: twoDaysAgoStr,
            placeName: 'Westside Hardware & Garden',
            address: '912 Porter Ave',
            category: 'errand_retail',
            latitude: 35.2255,
            longitude: -97.4299,
            startTime: day2Evening - 3 * hourMs,    // 2:00 PM
            endTime: day2Evening - 2.5 * hourMs,    // 2:30 PM
            durationMinutes: 30,
            assumedActivities: [
                'Spent 30 minutes browsing at Westside Hardware & Garden',
                'Completed an afternoon home or garden errand',
            ],
            cognitiveHint: 'You ran a 30-minute afternoon errand at a local hardware or garden shop.',
            userRecalledNote: 'Bought sunflower seeds for the backyard bird feeder.',
            recalledIndependently: false,
        },
    ];

    await saveRecallSummary({
        dateString: twoDaysAgoStr,
        visits: day2Visits,
        freeRecallText: 'I took a nice walk along Legacy Trail in the morning.',
        completedAt: day2Evening + 2 * hourMs,
        recallScorePercent: 50,
    });

    // ---------------------------------------------------------------------------
    // 4. THREE DAYS AGO (3 days ago): Completed recall summary with 3 stops (67% score)
    // ---------------------------------------------------------------------------
    const day3Evening = eveningAnchor(threeDaysAgoStr);
    const day3Visits: PlaceVisit[] = [
        {
            id: `${threeDaysAgoStr}-demo-1`,
            dateString: threeDaysAgoStr,
            placeName: 'Morning Glory Diner',
            address: '112 East Gray St',
            category: 'cafe_restaurant',
            latitude: 35.2233,
            longitude: -97.4412,
            startTime: day3Evening - 8.5 * hourMs,  // 8:30 AM
            endTime: day3Evening - 7.5 * hourMs,    // 9:30 AM
            durationMinutes: 60,
            assumedActivities: [
                'Had morning breakfast at Morning Glory Diner',
                'Enjoyed pancakes or eggs with morning coffee',
            ],
            cognitiveHint: 'You started the day with a sit-down breakfast at a local diner.',
            userRecalledNote: 'Had blueberry pancakes and coffee with my neighbor Tom.',
            recalledIndependently: true,
        },
        {
            id: `${threeDaysAgoStr}-demo-2`,
            dateString: threeDaysAgoStr,
            placeName: 'Norman Senior Wellness Center',
            address: '1000 Alameda St',
            category: 'community_social',
            latitude: 35.2194,
            longitude: -97.4265,
            startTime: day3Evening - 5 * hourMs,    // 12:00 PM
            endTime: day3Evening - 3.5 * hourMs,    // 1:30 PM
            durationMinutes: 90,
            assumedActivities: [
                'Participated in a community activity at Norman Senior Wellness Center',
                'Likely attended a group class, trivia session, or social gathering',
            ],
            cognitiveHint: 'You spent 90 minutes at a community center around midday.',
            userRecalledNote: 'Played watercolor painting and chatted with the art group.',
            recalledIndependently: true,
        },
        {
            id: `${threeDaysAgoStr}-demo-3`,
            dateString: threeDaysAgoStr,
            placeName: 'Sprouts Farmers Market',
            address: '559 West Main St',
            category: 'grocery_store',
            latitude: 35.2211,
            longitude: -97.4488,
            startTime: day3Evening - 2 * hourMs,    // 3:00 PM
            endTime: day3Evening - 1.5 * hourMs,    // 3:30 PM
            durationMinutes: 30,
            assumedActivities: [
                'Picked up fresh produce at Sprouts Farmers Market',
                'Stopped in for fruits and kitchen staples',
            ],
            cognitiveHint: 'You stopped at a market for 30 minutes in the afternoon.',
            userRecalledNote: 'Bought Honeycrisp apples and oatmeal.',
            recalledIndependently: false,
        },
    ];

    await saveRecallSummary({
        dateString: threeDaysAgoStr,
        visits: day3Visits,
        freeRecallText: 'Had pancakes with Tom and painted watercolors at the wellness center!',
        completedAt: day3Evening + 2.2 * hourMs,
        recallScorePercent: 67,
    });

    return todayVisits;
}