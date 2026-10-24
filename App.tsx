import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { initDatabase } from './src/db/database';
import HomeScreen from './src/screens/HomeScreen';
import EveningRecallScreen from './src/screens/EveningRecallScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import SingleDayScreen from './src/screens/SingleDayScreen';
import { RootStackParamList } from './src/navigation/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
    const [dbReady, setDbReady] = useState(false);

    useEffect(() => {
        (async () => {
            await initDatabase();
            setDbReady(true);
        })();
    }, []);

    if (!dbReady) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#1E3A8A" />
            </View>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator
                screenOptions={{
                    headerStyle: { backgroundColor: '#1E3A8A' },
                    headerTintColor: '#FFFFFF',
                    headerTitleStyle: { fontSize: 18, fontWeight: '800' },
                    headerBackButtonDisplayMode: "minimal"
                }}
            >
                <Stack.Screen
                    name="Home"
                    component={HomeScreen}
                    options={{ title: 'Memory Anchor' }}
                />
                <Stack.Screen
                    name="EveningRecall"
                    component={EveningRecallScreen}
                    options={{ title: 'Evening Recall' }}
                />
                <Stack.Screen
                    name="Calendar"
                    component={CalendarScreen}
                    options={{ title: 'Memory Calendar' }}
                />
                <Stack.Screen
                    name="SingleDay"
                    component={SingleDayScreen}
                    options={{ title: 'Day Overview' }}
                />


            </Stack.Navigator>
        </NavigationContainer>
    );
}