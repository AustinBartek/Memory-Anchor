import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
} from 'react-native';
import {
    start30SecondTracking,
    stop30SecondTracking,
    seedDemoDayForHackathon,
    compileTodayTimeline,
} from '../services/locationTask';
import {
    scheduleDailyEveningRecallPrompt,
    triggerInstantNotification,
} from '../services/notifications';
import { clearDatabase } from '../db/database';

interface Props {
    navigation: any;
}

export default function HomeScreen({ navigation }: Props) {
    const [isTracking, setIsTracking] = useState(false);
    const [stopCount, setStopCount] = useState(0);

    useEffect(() => {
        (async () => {
            const ok = await start30SecondTracking();
            setIsTracking(ok);
            await scheduleDailyEveningRecallPrompt(19, 30);
            const visits = await compileTodayTimeline();
            setStopCount(visits.length);
        })();
    }, []);

    const handleToggleTracking = async () => {
        if (isTracking) {
            await stop30SecondTracking();
            setIsTracking(false);
        } else {
            const ok = await start30SecondTracking();
            setIsTracking(ok);
        }
    };

    const handleLoadDemoDay = async () => {
        const visits = await seedDemoDayForHackathon();
        setStopCount(visits.length);
        Alert.alert(
            'Demo Data Loaded',
            'Seeded sample stops for today and the past 3 days!'
        );
    };

    const handleClearData = async () => {
        await clearDatabase();
        setStopCount(0);
        Alert.alert('Data Cleared', 'Removed all data from the local database.');
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            {/* Top Greeting Header */}
            <View style={styles.headerBanner}>
                <Text style={styles.greeting}>Good Day</Text>
                <Text style={styles.subtitle}>
                    Memory Anchor is quietly keeping notes on your day for tonight’s
                    reflection.
                </Text>
            </View>

            {/* Location Tracking Status Card */}
            <View style={styles.statusCard}>
                <View style={styles.statusBadgeRow}>
                    <View
                        style={[
                            styles.statusPill,
                            isTracking ? styles.statusPillActive : styles.statusPillPaused,
                        ]}
                    >
                        <View
                            style={[
                                styles.statusDot,
                                { backgroundColor: isTracking ? '#15803D' : '#DC2626' },
                            ]}
                        />
                        <Text
                            style={[
                                styles.statusPillText,
                                { color: isTracking ? '#14532D' : '#7F1D1D' },
                            ]}
                        >
                            {isTracking
                                ? '30-Second Location Journal: ON'
                                : 'Location Journal: PAUSED'}
                        </Text>
                    </View>
                </View>

                <View style={styles.metricRow}>
                    <Text style={styles.counterLabel}>Places recorded today</Text>
                    <Text style={styles.counterValue}>{stopCount}</Text>
                </View>

                <TouchableOpacity
                    style={styles.toggleTrackingButton}
                    onPress={handleToggleTracking}
                    accessibilityRole="button"
                >
                    <Text style={styles.toggleTrackingButtonText}>
                        {isTracking ? 'Pause Location Logging' : 'Resume Location Logging'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Primary User Actions */}
            <View style={styles.primaryActionsGroup}>
                <TouchableOpacity
                    style={styles.primaryRecallButton}
                    onPress={() => navigation.navigate('EveningRecall')}
                    accessibilityRole="button"
                >
                    <Text style={styles.primaryCardBadge}>TONIGHT’S EXERCISE</Text>
                    <Text style={styles.primaryRecallTitle}>
                        Start Evening Recall Exercise
                    </Text>
                    <Text style={styles.primaryRecallSub}>
                        Practice remembering your day, then view your full timeline
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.primaryCalendarButton}
                    onPress={() => navigation.navigate('Calendar')}
                    accessibilityRole="button"
                >
                    <Text style={styles.calendarCardBadge}>PAST MEMORIES</Text>
                    <Text style={styles.primaryCalendarTitle}>View Memory Calendar</Text>
                    <Text style={styles.primaryCalendarSub}>
                        Look back at previous days, visited places, and your reflections
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Hackathon Demo Controls Panel */}
            <View style={styles.demoPanel}>
                <Text style={styles.demoPanelTitle}>HACKATHON DEMO CONTROLS</Text>

                <View style={styles.devButtonRow}>
                    <TouchableOpacity
                        style={styles.sampleDataButton}
                        onPress={handleLoadDemoDay}
                        accessibilityRole="button"
                    >
                        <Text style={styles.demoActionText}>Load Sample Data</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.clearDataButton}
                        onPress={handleClearData}
                        accessibilityRole="button"
                    >
                        <Text style={styles.clearActionText}>Clear Database</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={styles.notificationButton}
                    onPress={async () => {
                        await triggerInstantNotification();
                    }}
                    accessibilityRole="button"
                >
                    <Text style={styles.notificationButtonText}>
                        Send Test Recall Notification
                    </Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 22,
        backgroundColor: '#F8FAFC',
        flexGrow: 1,
    },
    headerBanner: {
        marginBottom: 20,
    },
    greeting: {
        fontSize: 32,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 19,
        lineHeight: 27,
        color: '#475569',
    },
    statusCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        marginBottom: 22,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    statusBadgeRow: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 999,
    },
    statusPillActive: {
        backgroundColor: '#DCFCE7',
    },
    statusPillPaused: {
        backgroundColor: '#FEE2E2',
    },
    statusDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 10,
    },
    statusPillText: {
        fontSize: 16,
        fontWeight: '800',
    },
    metricRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    counterLabel: {
        fontSize: 18,
        fontWeight: '600',
        color: '#334155',
    },
    counterValue: {
        fontSize: 26,
        fontWeight: '800',
        color: '#1E3A8A',
    },
    toggleTrackingButton: {
        backgroundColor: '#F1F5F9',
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#CBD5E1',
    },
    toggleTrackingButtonText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1E293B',
    },
    primaryActionsGroup: {
        marginBottom: 24,
    },
    primaryRecallButton: {
        backgroundColor: '#1E3A8A',
        borderRadius: 20,
        paddingVertical: 22,
        paddingHorizontal: 22,
        marginBottom: 16,
        shadowColor: '#1E3A8A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryCardBadge: {
        fontSize: 13,
        fontWeight: '800',
        color: '#93C5FD',
        letterSpacing: 1,
        marginBottom: 6,
    },
    primaryRecallTitle: {
        fontSize: 23,
        fontWeight: '800',
        color: '#FFFFFF',
        marginBottom: 6,
    },
    primaryRecallSub: {
        fontSize: 17,
        color: '#DBEAFE',
        lineHeight: 23,
    },
    primaryCalendarButton: {
        backgroundColor: '#0F766E',
        borderRadius: 20,
        paddingVertical: 22,
        paddingHorizontal: 22,
        shadowColor: '#0F766E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
        elevation: 3,
    },
    calendarCardBadge: {
        fontSize: 13,
        fontWeight: '800',
        color: '#99F6E4',
        letterSpacing: 1,
        marginBottom: 6,
    },
    primaryCalendarTitle: {
        fontSize: 23,
        fontWeight: '800',
        color: '#FFFFFF',
        marginBottom: 6,
    },
    primaryCalendarSub: {
        fontSize: 17,
        color: '#CCFBF1',
        lineHeight: 23,
    },
    demoPanel: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 18,
        borderWidth: 1.5,
        borderColor: '#CBD5E1',
        borderStyle: 'dashed',
        marginBottom: 24,
    },
    demoPanelTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#64748B',
        letterSpacing: 1,
        marginBottom: 12,
        textAlign: 'center',
    },
    devButtonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    sampleDataButton: {
        flex: 1,
        backgroundColor: '#059669',
        borderRadius: 12,
        paddingVertical: 13,
        paddingHorizontal: 12,
        alignItems: 'center',
        marginRight: 6,
    },
    demoActionText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    clearDataButton: {
        flex: 1,
        backgroundColor: '#FEE2E2',
        borderWidth: 1.5,
        borderColor: '#EF4444',
        borderRadius: 12,
        paddingVertical: 13,
        paddingHorizontal: 12,
        alignItems: 'center',
        marginLeft: 6,
    },
    clearActionText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#B91C1C',
    },
    notificationButton: {
        backgroundColor: '#FEF3C7',
        borderWidth: 1.5,
        borderColor: '#F59E0B',
        borderRadius: 12,
        paddingVertical: 13,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    notificationButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#B45309',
    },
});