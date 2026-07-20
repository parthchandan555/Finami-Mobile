import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { ClientRow } from '@/features/clients/ClientRow';
import { fetchClientList, type ClientListEntry } from '@/lib/clients/data';

/**
 * Clients — read-only (v1 scope: list only, no add/edit, no writes).
 *
 * Lives at src/app/clients/index.tsx. The `clients` directory carries its own
 * <Stack /> layout, which is the documented way to push screens from inside a
 * native tab. Rows push /clients/[clientId].
 */
export default function ClientsScreen() {
  const scheme: 'light' | 'dark' = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientListEntry[]>([]);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      setClients(await fetchClientList(userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your clients.');
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

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false, title: 'Clients' }} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.text} />}
        >
          <View style={styles.headerRow}>
            <ThemedText type="title">Clients</ThemedText>
            {!loading && !error ? (
              <ThemedText type="small">
                {clients.length} active
              </ThemedText>
            ) : null}
          </View>

          {loading ? (
            <ThemedText type="small">Loading your clients…</ThemedText>
          ) : error ? (
            <View style={[styles.errorBox, { backgroundColor: c.destructiveTint }]}>
              <ThemedText type="smallBold" style={{ color: c.destructive }}>
                {error}
              </ThemedText>
              <Pressable onPress={onRefresh}>
                <ThemedText type="smallBold">Tap to retry</ThemedText>
              </Pressable>
            </View>
          ) : clients.length === 0 ? (
            <View style={styles.empty}>
              <ThemedText type="smallBold">No active clients yet.</ThemedText>
              <ThemedText type="small">
                Clients appear here once a connection request is accepted.
              </ThemedText>
            </View>
          ) : (
            <View style={styles.list}>
              {clients.map((entry) => (
                <ClientRow
                  key={entry.clientId}
                  entry={entry}
                  onPress={() =>
                    router.push({ pathname: '/clients/[clientId]', params: { clientId: entry.clientId } })
                  }
                />
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, alignSelf: 'stretch' },
  content: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.two,
  },
  list: { gap: Spacing.two },
  empty: { gap: Spacing.one },
  errorBox: { borderRadius: Spacing.two, padding: Spacing.three, gap: Spacing.two },
});
