import React, { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { fetchCaHomeData } from '@/lib/ca-home/data';
import { rankTriageItems } from '@/lib/ca-home/ranking';
import { computeCaTriage } from '@/lib/ca-home/rules/ca';
import type { TriageItem } from '@/lib/ca-home/types';

import { TriageRow } from '@/features/ca-home/TriageRow';

/**
 * Full attention queue — every triage item, uncapped. Reached from CA Home's
 * "N more need attention" line, which previously emitted the web slug
 * 'compliance-calendar' and landed on a "not built yet" Alert.
 *
 * CA Home caps at 8 rows and ranks tier-first, so T3 items (CA-5 documents,
 * CA-6 pending connections, CA-7 invoices) are structurally unreachable there
 * whenever T1/T2 filings fill the cap. This screen is where they surface.
 *
 * The header count is rows.length — what is actually rendered — never a
 * padded total. triageTotalPadding compensates for capped fetches in the data
 * layer; those items are counted on Home but have no row objects to render, so
 * they are stated separately rather than folded into a number that would imply
 * more rows exist below.
 */
export default function TriageQueueScreen() {
  const scheme: 'light' | 'dark' = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const { session } = useAuth();
  const userId = session?.user?.id ?? '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TriageItem[]>([]);
  const [padding, setPadding] = useState(0);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const d = await fetchCaHomeData(userId);
      setItems(computeCaTriage(d, new Date()));
      setPadding(d.triageTotalPadding);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the queue.');
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

  const handleNavigate = useCallback((target: TriageItem | string) => {
    if (typeof target !== 'string' && target.clientId) {
      router.push({ pathname: '/clients/[clientId]', params: { clientId: target.clientId } });
      return;
    }
    const href = typeof target === 'string' ? target : target.href;
    const label =
      href === 'clients'
        ? 'Clients'
        : href === 'itr-generation'
          ? 'ITR filings'
          : href === 'gst-module'
            ? 'GST returns'
            : href === 'documents'
              ? 'Documents'
              : href === 'invoicing'
                ? 'Invoices'
                : href;
    Alert.alert(
      label,
      href === 'clients'
        ? 'Open the Clients tab to see your active clients.'
        : 'This screen is not built yet.',
    );
  }, []);

  const { rows } = rankTriageItems(items, items.length);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Needs attention' }} />
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.text} />
          }
        >
          {loading ? (
            <ThemedText type="small">Loading the queue.</ThemedText>
          ) : error ? (
            <View style={styles.block}>
              <ThemedText type="smallBold">Could not load the queue.</ThemedText>
              <ThemedText type="small">{error}</ThemedText>
            </View>
          ) : rows.length === 0 ? (
            <View style={styles.block}>
              <ThemedText type="smallBold">All clear.</ThemedText>
              <ThemedText type="small">Nothing is waiting on you.</ThemedText>
            </View>
          ) : (
            <>
              <View style={styles.block}>
                <ThemedText type="smallBold">{rows.length} showing</ThemedText>
                {padding > 0 ? (
                  <ThemedText type="small">
                    {padding} more are counted on Home but come from a capped fetch and are not
                    listed here.
                  </ThemedText>
                ) : null}
              </View>
              <View style={styles.list}>
                {rows.map((item) => (
                  <TriageRow key={item.id} item={item} onPress={handleNavigate} />
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
