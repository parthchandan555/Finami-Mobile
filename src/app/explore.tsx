import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { ClientRow } from '@/features/clients/ClientRow';
import { fetchClientList, type ClientListEntry } from '@/lib/clients/data';

/**
 * Clients — read-only (v1 scope: list only, no add/edit, no writes).
 *
 * This screen replaces the stock Expo "Explore" template screen. The route
 * name stays `explore` deliberately: the root layout renders NativeTabs with
 * explicit triggers, so renaming the file would mean restructuring the
 * navigator. Only the tab's visible label changed.
 *
 * Client detail (profile + ITR/GST filings) is NOT in this screen — rows are
 * inert pending a stack route, which the current NativeTabs-only layout has
 * no place for yet.
 */
export default function ClientsScreen() {
  const scheme: 'light' | 'dark' = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
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
                <ClientRow key={entry.clientId} entry={entry} />
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
