import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function expoProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    undefined
  );
}

export async function registerForPushNotifications(authToken: string): Promise<string | null> {
  if (!Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'NutreLuma',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 240, 240, 240],
      lightColor: '#2563EB',
    });
  }

  const currentPermissions = await Notifications.getPermissionsAsync();
  let finalStatus = currentPermissions.status;
  if (finalStatus !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }
  if (finalStatus !== 'granted') return null;

  const projectId = expoProjectId();
  const tokenResult = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  const pushToken = tokenResult.data;
  await api.registerPushToken(authToken, {
    pushToken,
    platform: Platform.OS,
    deviceName: Device.deviceName ?? undefined,
  });
  return pushToken;
}

export async function unregisterPushNotifications(
  authToken: string,
  pushToken: string | null,
): Promise<void> {
  if (!pushToken) return;
  await api.unregisterPushToken(authToken, pushToken).catch(() => undefined);
}

export type PushData = Record<string, unknown>;

/** Καλείται όταν ο χρήστης πατήσει ένα push· επιστρέφει το data payload. */
export function addNotificationResponseListener(
  handler: (data: PushData) => void,
): { remove: () => void } {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    handler((response.notification.request.content.data ?? {}) as PushData);
  });
}

/** Cold start: αν το app άνοιξε από push, δίνει το data payload του. */
export async function getInitialNotificationData(): Promise<PushData | null> {
  const response = await Notifications.getLastNotificationResponseAsync();
  return (response?.notification.request.content.data ?? null) as PushData | null;
}
