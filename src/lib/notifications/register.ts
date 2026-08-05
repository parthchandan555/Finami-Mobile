import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

/**
 * The Expo push token most recently written to `push_tokens` by this app run.
 *
 * The cache and the database row are set on the same success path, so a
 * populated cache means a row exists. Sign out reads it to release that exact
 * row, which is why the release is token scoped and not user scoped: a person
 * signing out on one device must not silence push on another.
 */
let lastRegisteredToken: string | null = null;

export function getLastRegisteredPushToken(): string | null {
  return lastRegisteredToken;
}

export function forgetRegisteredPushToken(): void {
  lastRegisteredToken = null;
}

// Fire-and-forget: push registration must never throw into auth or app start.
export async function registerForPushNotifications(userId: string): Promise<void> {
  try {
    if (!Device.isDevice) return;
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;
    if (!projectId) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return;

    await supabase.rpc('register_push_token', {
      p_user_id: userId,
      p_token: token,
      p_platform: Platform.OS,
      p_device_id: Device.modelName ?? null,
    });

    lastRegisteredToken = token;
  } catch {
    // swallow — never break auth on a push failure
  }
}
