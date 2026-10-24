export interface RawLocationPoint {
    id?: number;
    latitude: number;
    longitude: number;
    timestamp: number; // Unix epoch ms
    dateString: string; // YYYY-MM-DD
}

export type PlaceCategory =
    | 'home'
    | 'cafe_restaurant'
    | 'grocery_store'
    | 'park_outdoors'
    | 'medical_pharmacy'
    | 'community_social'
    | 'errand_retail'
    | 'unknown';

export interface PlaceVisit {
    id: string;
    dateString: string;
    placeName: string;
    address: string;
    category: PlaceCategory;
    latitude: number;
    longitude: number;
    startTime: number;
    endTime: number;
    durationMinutes: number;
    assumedActivities: string[];
    cognitiveHint: string;
    userRecalledNote?: string;
    recalledIndependently?: boolean;
}

export interface DailyRecallSummary {
    dateString: string;
    visits: PlaceVisit[];
    freeRecallText: string;
    completedAt?: number;
    recallScorePercent?: number;
}