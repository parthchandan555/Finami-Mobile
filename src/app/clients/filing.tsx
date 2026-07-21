import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { fetchClientDetail, type ItrFilingEntry, type GstFilingEntry } from '@/lib/clients/detail';
import { formatPeriod } from '@/lib/ca-home/rules/ca';

/**
 * Filing detail — read-only. Reached by pressing an ITR or GST row on client
 * detail. Sibling route (not nested under [clientId]) so [clientId].tsx stays
 * a file, not a directory — see chat 8 recon before touching this decision.
 *
 * Re-fetches fetchClientDetail rather than threading data through params;
 * this screen is reached rarely enough that the extra round trip is cheap
 * and it avoids serializing filing objects into route params.
 *
 * No gst_filings jsonb amounts render here — see src/lib/clients/detail.ts
 * and project instructions §4 (money conventions). Not negotiable this chat.
 */
function prettyStatus(s: string): string {
  const t = s.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function prettyDate(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function prettyDateTime(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function FilingDetailScreen() {
  const scheme: 'light' | 'dark' = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const { clientId, filingId, kind } = useLocalSearchParams<{
    clientId: string;
    filingId: string;
    kind: 'itr' | 'gst';
  }>();
  const { session } = useAuth();
  const userId = session?.user?.id ?? '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [itr, setItr] = useState<ItrFilingEntry | null>(null);
  const [gst, setGst] = useState<GstFilingEntry | null>(null);
  const [clientName, setClientName] = useState<string>('');

  const load = useCallback(async () => {
    if (!userId || !clientId || !filingId) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const detail = await fetchClientDetail(userId, clientId);
      setClientName(detail.profile.name);
      if (kind === 'gst') {
        setGst(detail.gstFilings.find((f) => f.id === filingId) ?? null);
      } else {
        setItr(detail.itrFilings.find((f) => f.id === filingId) ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this filing.');
    } finally {
      setLoading(false);
    }
  }, [userId, clientId, filingId, kind]);

  useEffect(() => {
    load();
  }, [load]);

  const notFound = !loading && !error && !itr && !gst;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: kind === 'gst' ? 'GST Return' : 'ITR Filing' }} />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ThemedText type="small">Loading this filing…</ThemedText>
          ) : error ? (
            <View style={[styles.errorBox, { backgroundColor: c.destructiveTint }]}>
              <ThemedText type="smallBold" style={{ color: c.destructive }}>{error}</ThemedText>
            </View>
          ) : notFound ? (
            <ThemedText type="small">This filing could not be found.</ThemedText>
          ) : itr ? (
            <>
              <View style={styles.header}>
                <ThemedText type="title">{itr.itrType}</ThemedText>
                <ThemedText type="small">{clientName} · AY {itr.assessmentYear}</ThemedText>
              </View>

              <View style={[styles.card, { backgroundColor: c.backgroundElement }]}>
                <Row label="Status" value={prettyStatus(itr.status)} />
                {itr.dueDate ? <Row label="Due date" value={prettyDate(itr.dueDate) ?? '—'} /> : null}
                {itr.filedDate ? <Row label="Filed date" value={prettyDate(itr.filedDate) ?? '—'} /> : null}
                {itr.pan ? <Row label="PAN" value={itr.pan} /> : null}
                {itr.acknowledgementNumber ? (
                  <Row label="Acknowledgement no." value={itr.acknowledgementNumber} />
                ) : null}
                {itr.updatedAt ? (
                  <Row label="Last updated" value={prettyDateTime(itr.updatedAt) ?? '—'} />
                ) : null}
              </View>
            </>
          ) : gst ? (
            <>
              <View style={styles.header}>
                <ThemedText type="title">{gst.returnType}</ThemedText>
                <ThemedText type="small">
                  {clientName} · {formatPeriod(gst.period) || 'Period not set'}
                </ThemedText>
              </View>

              <View style={[styles.card, { backgroundColor: c.backgroundElement }]}>
                <Row label="Status" value={prettyStatus(gst.status)} />
                {gst.dueDate ? <Row label="Due date" value={prettyDate(gst.dueDate) ?? '—'} /> : null}
                {gst.filedDate ? <Row label="Filed date" value={prettyDate(gst.filedDate) ?? '—'} /> : null}
                <Row label="GSTIN" value={gst.gstin} />
                {gst.acknowledgementNumber ? (
                  <Row label="Acknowledgement no." value={gst.acknowledgementNumber} />
                ) : null}
                {gst.updatedAt ? (
                  <Row label="Last updated" value={prettyDateTime(gst.updatedAt) ?? '—'} />
                ) : null}
              </View>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small">{label}</ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, alignSelf: 'stretch' },
  content: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    paddingTop: Spacing.two,
    gap: Spacing.four,
  },
  header: { gap: 2 },
  card: { borderRadius: Spacing.two, padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  errorBox: { borderRadius: Spacing.two, padding: Spacing.three, gap: Spacing.two },
});
