import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { fetchNotifications, type NotificationEntry } from '@/lib/notifications/list';

import { NotificationRow } from '@/features/notifications/NotificationRow';

/**
 * In-app notification list — read-only, user-scoped inbox (no service_type
 * filter, unlike the CA surfaces: testpro1 sees both CA and RA
 * notifications here). No tap-to-navigate in v1 — that's the deferred
 * deep-link feature, which needs the push send-path designed first.
 * Mark-as-read is a deferred write (v1.1).
 */
export default function NotificationsScreen() {
  const scheme: 'light' | 'dark' = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const { session } = useAuth();
  const userId = session?.user?.id ?? '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationEntry[]>([]);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      setItems(await fetchNotifications(userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const unreadCount = items.filter((i) => !i.isRead).length;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Notifications' }} />
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.text} />
          }
        >
          {loading ? (
            <ThemedText type="small">Loading your notifications.</ThemedText>
          ) : error ? (
            <View style={styles.block}>
              <ThemedText type="smallBold">Could not load your notifications.</ThemedText>
              <ThemedText type="small">{error}</ThemedText>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.block}>
              <ThemedText type="smallBold">No notifications yet.</ThemedText>
              <ThemedText type="small">You will see updates here as they come in.</ThemedText>
            </View>
          ) : (
            <>
              <View style={styles.block}>
                <ThemedText type="smallBold">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                </ThemedText>
              </View>
              <View style={styles.list}>
                {items.map((item) => (
                  <NotificationRow key={item.id} item={item} />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    padding: Spacing.two,
    paddingBottom: BottomTabInset,
    gap: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  block: { gap: Spacing.one },
  list: { gap: Spacing.two },
});
