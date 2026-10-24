import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
} from 'react-native';
import { DailyRecallSummary } from '../types';
import { Calendar, CalendarList, Agenda } from 'react-native-calendars';
import { getAllRecallSummaries, getRecallSummaryByDate } from '../db/database';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

interface Props {
    navigation: any;
}

export default function CalendarScreen({ navigation }: Props) {
    const [summaries, setSummaries] = useState<DailyRecallSummary[]>([]);

    useFocusEffect(
        useCallback(() => {
            getAllRecallSummaries().then(setSummaries); // add this DB function
        }, [])
    );

    const markedDates = useMemo(() => {
        const marks: Record<string, any> = {};
        for (const s of summaries) {
            marks[s.dateString] = {
                customStyles: {
                    container: { backgroundColor: colorFor(s), borderRadius: 8 },
                    text: { color: 'white', fontWeight: '600' },
                },
            };
        }
        return marks;
    }, [summaries]);

    return (
        <Calendar
            markingType="custom"
            markedDates={markedDates}
            onDayPress={
                async (day) => {
                    /*TODO query the database and find the DailyRecallSummary that matches this day. If none, then popup-->
                 a notification that says there are none */
                    const recall = await getRecallSummaryByDate(day.dateString);
                    if (recall == null) {
                        Alert.alert('No memories yet', 'There is no recall summary for this day.');
                        return;
                    }
                    navigation.navigate('SingleDay', { dateString: day.dateString });
                }
            }>

        </Calendar>
    )

    function colorFor(s: DailyRecallSummary) {
        return "#5555aa";
    }
}