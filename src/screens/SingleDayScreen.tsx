import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { DailyRecallSummary } from '../types';
import { getRecallSummaryByDate } from '../db/database';
import { getTodayDateString } from '../services/locationTask';

interface SingleDayProps {
    navigation: any;
    route: {
        params?: {
            dateString?: string;
            summary?: DailyRecallSummary;
        };
    };
}

export default function SingleDayScreen({ navigation, route }: SingleDayProps) {
    const dateString =
        route?.params?.dateString ||
        route?.params?.summary?.dateString ||
        getTodayDateString();

    const [summary, setSummary] = useState<DailyRecallSummary | null>(
        route?.params?.summary ?? null
    );
    const [loading, setLoading] = useState(!route?.params?.summary);

    useEffect(() => {
        (async () => {
            setLoading(true);
            const fetched = await getRecallSummaryByDate(dateString);
            setSummary(fetched);
            setLoading(false);
        })();
    }, [dateString]);

    const formatTime = (epochMs: number) => {
        return new Date(epochMs).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    const formatReadableDate = (yyyyMmDd: string) => {
        const parts = yyyyMmDd.split('-');
        if (parts.length === 3) {
            const dateObj = new Date(
                Number(parts[0]),
                Number(parts[1]) - 1,
                Number(parts[2])
            );
            return dateObj.toLocaleDateString([], {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
            });
        }
        return yyyyMmDd;
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#1E3A8A" />
            </View>
        );
    }

    if (!summary || (summary.visits.length === 0 && !summary.freeRecallText)) {
        return (
            <View style={styles.container}>
                <View style={styles.headerCard}>
                    <Text style={styles.dateBadge}>{formatReadableDate(dateString)}</Text>
                    <Text style={styles.emptyTitle}>No Memories Recorded for This Day</Text>
                    <Text style={styles.emptyBody}>
                        There are no saved place visits or reflections for {dateString} yet.
                    </Text>
                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.primaryButtonText}>Back to Calendar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.container}>
            {/* Day Overview & Overall Free-Recall Reflection */}
            <View style={styles.headerCard}>
                <Text style={styles.dateBadge}>{formatReadableDate(summary.dateString)}</Text>
                <Text style={styles.heading}>Daily Memory & Activity Log</Text>

                <View style={styles.overallReflectionBox}>
                    <Text style={styles.overallReflectionLabel}>
                        Initial Evening Recall Reflection:
                    </Text>
                    <Text style={styles.overallReflectionText}>
                        {summary.freeRecallText && summary.freeRecallText.trim().length > 0
                            ? `“${summary.freeRecallText}”`
                            : 'No initial free-recall note was entered for this day.'}
                    </Text>
                </View>
            </View>

            {/* Chronological List of Stops, Assumed Activities & User Reflections */}
            <Text style={styles.sectionTitle}>
                Places Visited & Reflections ({summary.visits.length})
            </Text>

            {summary.visits.map((visit, index) => {
                const hasNote =
                    visit.userRecalledNote && visit.userRecalledNote.trim().length > 0;

                return (
                    <View key={visit.id} style={styles.visitCard}>
                        <View style={styles.visitHeaderRow}>
                            <Text style={styles.stopBadge}>STOP {index + 1}</Text>
                            <Text style={styles.timeText}>
                                {formatTime(visit.startTime)} – {formatTime(visit.endTime)} (
                                {visit.durationMinutes} min)
                            </Text>
                        </View>

                        <Text style={styles.placeName}>{visit.placeName}</Text>
                        <Text style={styles.placeAddress}>{visit.address}</Text>

                        {/* Assumed Activities */}
                        <View style={styles.assumptionsContainer}>
                            <Text style={styles.assumptionsTitle}>Assumed Activities:</Text>
                            {visit.assumedActivities.map((activity, idx) => (
                                <Text key={idx} style={styles.assumptionBullet}>
                                    • {activity}
                                </Text>
                            ))}
                        </View>

                        {/* User's Personal Reflection for This Stop */}
                        <View
                            style={[
                                styles.reflectionContainer,
                                !hasNote && styles.reflectionContainerEmpty,
                            ]}
                        >
                            <Text style={styles.reflectionTitle}>Your Reflection at This Stop:</Text>
                            <Text
                                style={[
                                    styles.reflectionBody,
                                    !hasNote && styles.reflectionBodyEmpty,
                                ]}
                            >
                                {hasNote
                                    ? `“${visit.userRecalledNote}”`
                                    : 'No personal reflection recorded for this stop.'}
                            </Text>
                        </View>
                    </View>
                );
            })}

            <TouchableOpacity
                style={[styles.secondaryButton, { marginBottom: 32 }]}
                onPress={() =>
                    navigation.navigate('EveningRecall', { dateString: summary.dateString })
                }
            >
                <Text style={styles.secondaryButtonText}>
                    Edit Reflections for This Day
                </Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        backgroundColor: '#F8FAFC',
        flexGrow: 1,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
    },
    headerCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 22,
        borderWidth: 2,
        borderColor: '#CBD5E1',
        marginBottom: 22,
    },
    dateBadge: {
        fontSize: 15,
        fontWeight: '800',
        color: '#1E3A8A',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 6,
    },
    heading: {
        fontSize: 26,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 16,
    },
    overallReflectionBox: {
        backgroundColor: '#ECFDF5',
        borderRadius: 14,
        padding: 16,
        borderWidth: 1.5,
        borderColor: '#10B981',
    },
    overallReflectionLabel: {
        fontSize: 16,
        fontWeight: '800',
        color: '#065F46',
        marginBottom: 6,
    },
    overallReflectionText: {
        fontSize: 19,
        lineHeight: 27,
        color: '#064E3B',
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 14,
    },
    visitCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 22,
        borderWidth: 2,
        borderColor: '#CBD5E1',
        marginBottom: 18,
    },
    visitHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    stopBadge: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1E3A8A',
    },
    timeText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#475569',
    },
    placeName: {
        fontSize: 24,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 4,
    },
    placeAddress: {
        fontSize: 17,
        color: '#64748B',
        marginBottom: 14,
    },
    assumptionsContainer: {
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        padding: 14,
        marginBottom: 14,
    },
    assumptionsTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 6,
    },
    assumptionBullet: {
        fontSize: 18,
        lineHeight: 26,
        color: '#334155',
        marginBottom: 4,
    },
    reflectionContainer: {
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
        padding: 16,
        borderLeftWidth: 5,
        borderLeftColor: '#1E3A8A',
    },
    reflectionContainerEmpty: {
        backgroundColor: '#F8FAFC',
        borderLeftColor: '#94A3B8',
    },
    reflectionTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1E3A8A',
        marginBottom: 6,
    },
    reflectionBody: {
        fontSize: 19,
        lineHeight: 27,
        color: '#1E293B',
    },
    reflectionBodyEmpty: {
        fontStyle: 'italic',
        color: '#64748B',
    },
    emptyTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 8,
    },
    emptyBody: {
        fontSize: 18,
        lineHeight: 26,
        color: '#475569',
        marginBottom: 20,
    },
    primaryButton: {
        backgroundColor: '#1E3A8A',
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
    },
    primaryButtonText: {
        fontSize: 19,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    secondaryButton: {
        backgroundColor: '#E2E8F0',
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
    },
    secondaryButtonText: {
        fontSize: 19,
        fontWeight: '700',
        color: '#1E293B',
    },
});