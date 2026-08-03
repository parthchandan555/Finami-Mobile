import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { fetchNotifications, type NotificationEntry } from '@/lib/notifications/list';
import { markAllNotificationsRead, markNotificationRead } from '@/lib/notifications/mark-read';

import { NotificationRow } from '@/features/notifications/NotificationRow';

/**
 * In-app notification list — user-scoped inbox (no service_type filter,
 * unlike the CA surfaces: testpro1 sees both CA and RA notifications here).
 *
 * Tapping a row does up to two things: it marks the row read if it was
 * unread, and it navigates if the row resolves to a target. Either may happen
 * without the other. The write is not awaited, so a slow or failed mark never
 * delays the navigation.
 *
 * "Mark all read" and per-row mark-as-read are THE ONLY mobile writes — a
 * deliberate, named break in the read-only-except-auth rule. It goes through
 * SECURITY DEFINER RPCs, never a direct table update. See mark-read.ts.
 */
export default function NotificationsScreen({
  onOpenClient,
}: {
  onOpenClient?: (clientId: string) => void;
} = {}) {
  const scheme: 'light' | 'dark' = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const { session } = useAuth();
  const userId = session?.user?.id ?? '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationEntry[]>([]);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);

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

  const onMarkAllRead = useCallback(async () => {
    if (marking) return;
    setMarking(true);
    setMarkError(null);
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((i) => (i.isRead ? i : { ...i, isRead: true })));
      try {
        await Notifications.setBadgeCountAsync(0);
      } catch {
        // The app-icon badge is cosmetic. A failure here must never surface
        // as a failed mark-as-read, which has already committed.
      }
    } catch (e) {
      setMarkError(e instanceof Error ? e.message : 'Could not mark them read.');
    } finally {
      setMarking(false);
    }
  }, [marking]);

  const unreadCount = items.filter((i) => !i.isRead).length;

  // Read inside the async badge update so it sees the post-update list, not
  // the list captured at the moment the tap fired.
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const markOneRead = useCallback(async (id: string) => {
    setMarkError(null);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, isRead: true } : i)));
    try {
      await markNotificationRead(id);
      try {
        await Notifications.setBadgeCountAsync(
          itemsRef.current.filter((i) => !i.isRead).length,
        );
      } catch {
        // The app-icon badge is cosmetic. A failure here must never surface as
        // a failed mark-as-read, which has already committed.
      }
    } catch (e) {
      // Roll the optimistic update back: the row is still unread on the server.
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, isRead: false } : i)));
      setMarkError(e instanceof Error ? e.message : 'Could not mark it read.');
    }
  }, []);

  const onRowPress = useCallback(
    (item: NotificationEntry) => {
      if (!item.isRead) {
        // Deliberately not awaited: navigation must not wait on a write.
        markOneRead(item.id);
      }
      if (item.target?.kind === 'client' && onOpenClient) {
        onOpenClient(item.target.clientId);
      }
    },
    [markOneRead, onOpenClient],
  );

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
                <View style={styles.headerRow}>
                  <ThemedText type="smallBold">
                    {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                  </ThemedText>
                  {unreadCount > 0 ? (
                    <Pressable
                      onPress={onMarkAllRead}
                      disabled={marking}
                      accessibilityRole="button"
                      accessibilityLabel="Mark all notifications read"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={({ pressed }) => ({ opacity: pressed || marking ? 0.6 : 1 })}
                    >
                      <ThemedText type="smallBold" themeColor="accent">
                        {marking ? 'Marking…' : 'Mark all read'}
                      </ThemedText>
                    </Pressable>
                  ) : null}
                </View>
                {markError ? (
                  <ThemedText type="small" themeColor="destructive">
                    {markError}
                  </ThemedText>
                ) : null}
              </View>
              <View style={styles.list}>
                {items.map((item) => (
                  <NotificationRow key={item.id} item={item} onPress={onRowPress} />
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  list: { gap: Spacing.two },
});
