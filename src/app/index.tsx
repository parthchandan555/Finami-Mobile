import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { fetchCaHomeData, type CaHomeData } from '@/lib/ca-home/data';
import {
  computeCaHorizon,
  computeCaNextDeadline,
  computeCaTriage,
  type CaNextDeadline,
} from '@/lib/ca-home/rules/ca';
import type { HorizonDay, TriageItem } from '@/lib/ca-home/types';

import { AttentionQueue } from '@/features/ca-home/AttentionQueue';
import { HorizonStrip } from '@/features/ca-home/HorizonStrip';
import { PulseChip } from '@/features/ca-home/PulseChip';
import { ZoneSection } from '@/features/ca-home/ZoneSection';

/**
 * CA Home v1 — read-only. Ports the web triage rules verbatim (pure
 * functions with `today` injected) and replicates the verified web data
 * layer. No writes. Navigation targets are the web page slugs the rules
 * emit; mobile screens for those do not exist yet, so presses are inert
 * for now (deliberate — client list / filing detail are the next slice).
 */
export default function CaHomeScreen() {
  const scheme: 'light' | 'dark' = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const { session, signOut } = useAuth();
  const userId = session?.user?.id ?? '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CaHomeData | null>(null);
  const [items, setItems] = useState<TriageItem[]>([]);
  const [horizon, setHorizon] = useState<HorizonDay[]>([]);
  const [nextDeadline, setNextDeadline] = useState<CaNextDeadline | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const d = await fetchCaHomeData(userId);
      const today = new Date();
      setData(d);
      setItems(computeCaTriage(d, today));
      setHorizon(computeCaHorizon(d, today));
      setNextDeadline(computeCaNextDeadline(d, today));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your home screen.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Triage rows carry only a destination slug, never a client id, so a press
  // cannot yet open a specific record. Surfacing that honestly beats an inert
  // tap. Adding `clientId` to TriageItem is the next slice.
  const handleNavigate = useCallback((href: string) => {
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const trueTotal = data ? items.length + data.triageTotalPadding : undefined;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.text} />}
        >
          <View style={styles.headerRow}>
            <ThemedText type="title">Home</ThemedText>
            <Pressable
              onPress={signOut}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              style={({ pressed }) => [
                styles.signOut,
                { backgroundColor: pressed ? c.backgroundSelected : c.backgroundElement },
              ]}
            >
              <ThemedText type="smallBold">Sign out</ThemedText>
            </Pressable>
          </View>

          {loading ? (
            <ThemedText type="small">Loading your work…</ThemedText>
          ) : error ? (
            <View style={[styles.errorBox, { backgroundColor: c.destructiveTint }]}>
              <ThemedText type="smallBold" style={{ color: c.destructive }}>
                {error}
              </ThemedText>
              <Pressable onPress={onRefresh}>
                <ThemedText type="smallBold">Tap to retry</ThemedText>
              </Pressable>
            </View>
          ) : (
            <>
              <AttentionQueue
                items={items}
                trueTotal={trueTotal}
                onNavigate={handleNavigate}
                emptyState={
                  <View style={styles.empty}>
                    <ThemedText type="smallBold">All clear.</ThemedText>
                    <ThemedText type="small">
                      No filings due in the next 7 days and nothing is waiting on you.
                    </ThemedText>
                    {nextDeadline ? (
                      <ThemedText type="small">
                        Next deadline: {nextDeadline.label} for {nextDeadline.client}, {nextDeadline.date}
                      </ThemedText>
                    ) : null}
                  </View>
                }
              />

              <HorizonStrip days={horizon} />

              {data && (data.inProgress.itr > 0 || data.inProgress.gst > 0) ? (
                <ZoneSection title="Work in motion">
                  <View style={styles.wipRow}>
                    {data.inProgress.itr > 0 ? (
                      <View style={[styles.wipCard, { backgroundColor: c.backgroundElement }]}>
                        <ThemedText type="smallBold">
                          {data.inProgress.itr} ITR filing{data.inProgress.itr === 1 ? '' : 's'} in progress
                        </ThemedText>
                      </View>
                    ) : null}
                    {data.inProgress.gst > 0 ? (
                      <View style={[styles.wipCard, { backgroundColor: c.backgroundElement }]}>
                        <ThemedText type="smallBold">
                          {data.inProgress.gst} GST return{data.inProgress.gst === 1 ? '' : 's'} in progress
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                </ZoneSection>
              ) : null}

              {data ? (
                <ZoneSection title="Pulse">
                  <View style={styles.pulseRow}>
                    <PulseChip label="Active clients" value={data.pulse.activeClients} />
                    <PulseChip label="Pending requests" value={data.pulse.pendingRequests} />
                    <PulseChip label="Docs pending" value={data.pulse.docsPending} />
                    <PulseChip
                      label="Avg rating"
                      value={data.pulse.ratingCount > 0 ? data.pulse.avgRating.toFixed(1) : '—'}
                    />
                  </View>
                </ZoneSection>
              ) : null}
            </>
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
  signOut: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  empty: { gap: Spacing.one },
  errorBox: { borderRadius: Spacing.two, padding: Spacing.three, gap: Spacing.two },
  wipRow: { gap: Spacing.two },
  wipCard: { borderRadius: Spacing.two, padding: Spacing.three },
  pulseRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
