import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { PlaceVisit, DailyRecallSummary } from '../types';
import { compileTodayTimeline, getTodayDateString } from '../services/locationTask';
import {
    getRecallSummaryByDate,
    saveRecallSummary,
    savePlaceVisit,
} from '../db/database';

type RecallStage = 'free_recall' | 'guided_hints' | 'reveal_timeline';

interface EveningRecallProps {
    navigation: any;
    route?: {
        params?: {
            dateString?: string;
        };
    };
}

export default function EveningRecallScreen({ navigation, route }: EveningRecallProps) {
    const targetDate = route?.params?.dateString || getTodayDateString();

    const [stage, setStage] = useState<RecallStage>('free_recall');
    const [visits, setVisits] = useState<PlaceVisit[]>([]);
    const [freeRecallInput, setFreeRecallInput] = useState('');
    const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});
    const [stopReflections, setStopReflections] = useState<Record<string, string>>({});

    useEffect(() => {
        (async () => {
            if (targetDate === getTodayDateString()) {
                await compileTodayTimeline();
            }

            const existingSummary = await getRecallSummaryByDate(targetDate);
            if (existingSummary) {
                setVisits(existingSummary.visits);
                setFreeRecallInput(existingSummary.freeRecallText || '');

                const initialChecks: Record<string, boolean> = {};
                const initialReflections: Record<string, string> = {};
                existingSummary.visits.forEach((v) => {
                    initialChecks[v.id] = Boolean(v.recalledIndependently);
                    if (v.userRecalledNote) {
                        initialReflections[v.id] = v.userRecalledNote;
                    }
                });
                setCheckedIds(initialChecks);
                setStopReflections(initialReflections);
            }
        })();
    }, [targetDate]);

    const formatTime = (epochMs: number) => {
        return new Date(epochMs).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    const toggleRemembered = async (visit: PlaceVisit) => {
        const nextVal = !checkedIds[visit.id];
        setCheckedIds((prev) => ({ ...prev, [visit.id]: nextVal }));

        const updatedVisits = visits.map((v) =>
            v.id === visit.id ? { ...v, recalledIndependently: nextVal } : v
        );
        setVisits(updatedVisits);

        await savePlaceVisit({
            ...visit,
            recalledIndependently: nextVal,
        });
    };

    const handleStopReflectionChange = (visitId: string, text: string) => {
        setStopReflections((prev) => ({
            ...prev,
            [visitId]: text,
        }));
    };

    const handleSubmitReflections = async () => {
        const totalStops = visits.length;
        const rememberedCount = visits.filter((v) => checkedIds[v.id]).length;

        const updatedVisits: PlaceVisit[] = visits.map((visit) => {
            const note = (stopReflections[visit.id] ?? '').trim();
            const wasChecked = Boolean(checkedIds[visit.id]);
            return {
                ...visit,
                userRecalledNote: note,
                recalledIndependently: wasChecked,
            };
        });

        const summaryToSave: DailyRecallSummary = {
            dateString: targetDate,
            visits: updatedVisits,
            freeRecallText: freeRecallInput.trim(),
            completedAt: Date.now(),
            recallScorePercent:
                totalStops > 0 ? Math.round((rememberedCount / totalStops) * 100) : 0,
        };

        await saveRecallSummary(summaryToSave);

        navigation.navigate('SingleDay', {
            dateString: targetDate,
        });
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            {stage === 'free_recall' && (
                <View style={styles.card}>
                    <Text style={styles.stepBadge}>STEP 1 OF 3 • GENTLE RECALL</Text>
                    <Text style={styles.heading}>What stands out from your day today?</Text>
                    <Text style={styles.bodyText}>
                        Before we look at your location list, take a moment to picture your
                        morning and afternoon. Where did you go, or what did you enjoy doing?
                    </Text>

                    <TextInput
                        style={styles.textInput}
                        multiline
                        placeholder="Type or use keyboard voice dictation (e.g., 'Had coffee this morning, walked in the park...')"
                        placeholderTextColor="#64748B"
                        value={freeRecallInput}
                        onChangeText={setFreeRecallInput}
                    />

                    <TouchableOpacity
                        style={styles.hintButton}
                        onPress={() => setStage('guided_hints')}
                    >
                        <Text style={styles.hintButtonText}>
                            Give Me Gentle Clues ({visits.length} stops today)
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={() => setStage('reveal_timeline')}
                    >
                        <Text style={styles.primaryButtonText}>
                            Show My Full Day’s Places & Activities
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {stage === 'guided_hints' && (
                <View style={styles.card}>
                    <Text style={styles.stepBadge}>STEP 2 OF 3 • HELPFUL HINTS</Text>
                    <Text style={styles.heading}>Here are a few clues from your day</Text>
                    <Text style={styles.bodyText}>
                        See if these time-of-day hints spark a memory of where you were:
                    </Text>

                    {visits.map((visit, idx) => {
                        const remembered = Boolean(checkedIds[visit.id]);
                        return (
                            <View key={visit.id} style={styles.hintItem}>
                                <Text style={styles.hintTime}>
                                    Stop #{idx + 1} • {formatTime(visit.startTime)} ({visit.durationMinutes} mins)
                                </Text>
                                <Text style={styles.hintClueText}>“{visit.cognitiveHint}”</Text>

                                <TouchableOpacity
                                    style={[
                                        styles.checkButton,
                                        remembered && styles.checkButtonActive,
                                    ]}
                                    onPress={() => toggleRemembered(visit)}
                                >
                                    <Text
                                        style={[
                                            styles.checkButtonText,
                                            remembered && styles.checkButtonTextActive,
                                        ]}
                                    >
                                        {remembered
                                            ? '✓ I Remembered This!'
                                            : 'I Remembered This'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        );
                    })}

                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={() => setStage('reveal_timeline')}
                    >
                        <Text style={styles.primaryButtonText}>
                            Reveal Places & Activity Assumptions
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {stage === 'reveal_timeline' && (
                <View>
                    <View style={styles.card}>
                        <Text style={styles.stepBadge}>STEP 3 OF 3 • YOUR DAILY TIMELINE</Text>
                        <Text style={styles.heading}>Your Day in Review</Text>

                        {freeRecallInput.trim().length > 0 && (
                            <View style={styles.userMemoryBox}>
                                <Text style={styles.userMemoryLabel}>What You Recalled First:</Text>
                                <Text style={styles.userMemoryContent}>“{freeRecallInput}”</Text>
                            </View>
                        )}

                        <Text style={styles.bodyText}>
                            Review your stops below and jot down any personal reflections or memories
                            from each place:
                        </Text>
                    </View>

                    {visits.map((visit, index) => (
                        <View key={visit.id} style={styles.timelineCard}>
                            <View style={styles.timelineHeader}>
                                <Text style={styles.stopNumber}>STOP {index + 1}</Text>
                                <Text style={styles.timeRange}>
                                    {formatTime(visit.startTime)} – {formatTime(visit.endTime)} (
                                    {visit.durationMinutes} min)
                                </Text>
                            </View>

                            <Text style={styles.placeTitle}>{visit.placeName}</Text>
                            <Text style={styles.placeAddress}>{visit.address}</Text>

                            <View style={styles.assumptionBox}>
                                <Text style={styles.assumptionHeader}>
                                    Assumed Activities at This Stop:
                                </Text>
                                {visit.assumedActivities.map((act, i) => (
                                    <Text key={i} style={styles.assumptionBullet}>
                                        • {act}
                                    </Text>
                                ))}
                            </View>

                            <Text style={styles.reflectionInputLabel}>
                                Your Reflection for Stop #{index + 1}:
                            </Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="Reflect on your activity at this stop (e.g., who you saw, what you ordered, or how you felt)..."
                                placeholderTextColor="#64748B"
                                multiline
                                value={stopReflections[visit.id] ?? ''}
                                onChangeText={(text) => handleStopReflectionChange(visit.id, text)}
                            />
                        </View>
                    ))}

                    <TouchableOpacity
                        style={[styles.primaryButton, { marginBottom: 32 }]}
                        onPress={handleSubmitReflections}
                    >
                        <Text style={styles.primaryButtonText}>Submit & View Day Summary</Text>
                    </TouchableOpacity>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        backgroundColor: '#F8FAFC',
        flexGrow: 1,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 22,
        borderWidth: 2,
        borderColor: '#CBD5E1',
        marginBottom: 20,
    },
    stepBadge: {
        fontSize: 15,
        fontWeight: '800',
        color: '#1E3A8A',
        letterSpacing: 0.8,
        marginBottom: 8,
    },
    heading: {
        fontSize: 26,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 10,
    },
    bodyText: {
        fontSize: 19,
        lineHeight: 27,
        color: '#334155',
        marginBottom: 16,
    },
    reflectionInputLabel: {
        fontSize: 17,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 8,
    },
    textInput: {
        backgroundColor: '#F1F5F9',
        borderRadius: 14,
        borderWidth: 2,
        borderColor: '#94A3B8',
        padding: 16,
        fontSize: 19,
        color: '#0F172A',
        minHeight: 110,
        textAlignVertical: 'top',
        marginBottom: 12,
    },
    hintButton: {
        backgroundColor: '#EFF6FF',
        borderWidth: 2,
        borderColor: '#1E3A8A',
        borderRadius: 14,
        paddingVertical: 16,
        paddingHorizontal: 8,
        alignItems: 'center',
        marginBottom: 14,
    },
    hintButtonText: {
        fontSize: 19,
        fontWeight: '700',
        color: '#1E3A8A',
    },
    primaryButton: {
        backgroundColor: '#1E3A8A',
        borderRadius: 14,
        paddingVertical: 18,
        paddingHorizontal: 8,
        alignItems: 'center',
    },
    primaryButtonText: {
        fontSize: 20,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    hintItem: {
        backgroundColor: '#F8FAFC',
        borderLeftWidth: 5,
        borderLeftColor: '#2563EB',
        padding: 16,
        borderRadius: 10,
        marginBottom: 14,
    },
    hintTime: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1E3A8A',
        marginBottom: 4,
    },
    hintClueText: {
        fontSize: 19,
        fontStyle: 'italic',
        color: '#1E293B',
        lineHeight: 26,
        marginBottom: 12,
    },
    checkButton: {
        borderWidth: 2,
        borderColor: '#15803D',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 10,
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    checkButtonActive: {
        backgroundColor: '#15803D',
    },
    checkButtonText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#15803D',
    },
    checkButtonTextActive: {
        color: '#FFFFFF',
    },
    userMemoryBox: {
        backgroundColor: '#ECFDF5',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#10B981',
        marginBottom: 16,
    },
    userMemoryLabel: {
        fontSize: 16,
        fontWeight: '800',
        color: '#065F46',
        marginBottom: 4,
    },
    userMemoryContent: {
        fontSize: 19,
        color: '#064E3B',
    },
    timelineCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 22,
        borderWidth: 2,
        borderColor: '#CBD5E1',
        marginBottom: 18,
    },
    timelineHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    stopNumber: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1E3A8A',
    },
    timeRange: {
        fontSize: 16,
        fontWeight: '700',
        color: '#475569',
    },
    placeTitle: {
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
    assumptionBox: {
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
    },
    assumptionHeader: {
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
});