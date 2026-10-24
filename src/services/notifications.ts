import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export async function scheduleDailyEveningRecallPrompt(
    hour = 19,
    minute = 30
): Promise<void> {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    await Notifications.cancelAllScheduledNotificationsAsync();

    await Notifications.scheduleNotificationAsync({
        content: {
            title: 'Time for Your Evening Memory Reflection',
            body: 'Let’s take 2 calm minutes to recall the places you visited today.',
            data: { screen: 'EveningRecall' },
        },
        trigger: {
            hour,
            minute,
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
        },
    });
}

export async function triggerInstantNotification(): Promise<void> {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    await Notifications.scheduleNotificationAsync({
        content: {
            title: 'Time for Your Evening Memory Reflection',
            body: 'Let’s take 2 calm minutes to recall the places you visited today.',
            data: { screen: 'EveningRecall' },
        },
        trigger: null,
    });
}