import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { FilingRow, type FilingTone } from '@/features/clients/FilingRow';
import { fetchClientDetail, type ClientDetail } from '@/lib/clients/detail';
import { formatPeriod } from '@/lib/ca-home/rules/ca';

/**
 * Client detail — read-only. Reached by pressing a row on the Clients tab.
 *
 * The GST section is empty for most clients (14 of testpro1's 44 have any GST
 * filings at all), so the empty state is the common case, not an edge case.
 * No amounts render anywhere on this screen; see src/lib/clients/detail.ts.
 */
const ITR_TERMINAL = new Set(['filed', 'processed', 'verified']);
const GST_TERMINAL = new Set(['filed']);

function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

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

function toneFor(status: string, dueDate: string | null, terminal: Set<string>): FilingTone {
  if (terminal.has(status)) return 'done';
  if (dueDate && dueDate.slice(0, 10) < todayISO()) return 'overdue';
  return 'open';
}

export default function ClientDetailScreen({
  onOpenFiling,
}: {
  onOpenFiling: (args: { clientId: string; filingId: string; kind: string }) => void;
}) {
  const scheme: 'light' | 'dark' = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { session } = useAuth();
  const userId = session?.user?.id ?? '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClientDetail | null>(null);

  const load = useCallback(async () => {
    if (!userId || !clientId) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      setDetail(await fetchClientDetail(userId, clientId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this client.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const place = [detail?.profile.city, detail?.profile.state].filter(Boolean).join(', ');
  const pan = detail?.itrFilings.find((f) => f.pan)?.pan ?? null;
  const gstin = detail?.gstFilings.find((f) => f.gstin)?.gstin ?? null;
  const connectedOn = prettyDate(detail?.connection?.connectedAt ?? null);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: detail?.profile.name ?? 'Client' }} />
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.text} />}
        >
          {loading ? (
            <ThemedText type="small">Loading this client…</ThemedText>
          ) : error ? (
            <View style={[styles.errorBox, { backgroundColor: c.destructiveTint }]}>
              <ThemedText type="smallBold" style={{ color: c.destructive }}>{error}</ThemedText>
            </View>
          ) : detail ? (
            <>
              {detail.profile.designation || place ? (
                <View style={styles.header}>
                  {detail.profile.designation ? (
                    <ThemedText type="small">{detail.profile.designation}</ThemedText>
                  ) : null}
                  {place ? <ThemedText type="small">{place}</ThemedText> : null}
                </View>
              ) : null}

              <View style={[styles.card, { backgroundColor: c.backgroundElement }]}>
                <ThemedText type="smallBold">Connection</ThemedText>
                <ThemedText type="small">
                  {detail.connection
                    ? `${detail.connection.serviceType} · ${prettyStatus(detail.connection.status)}`
                    : 'No active CA connection'}
                </ThemedText>
                {connectedOn ? <ThemedText type="small">Connected {connectedOn}</ThemedText> : null}
                {pan ? <ThemedText type="small">PAN {pan}</ThemedText> : null}
                {gstin ? <ThemedText type="small">GSTIN {gstin}</ThemedText> : null}
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <ThemedText type="subtitle">ITR filings</ThemedText>
                  <ThemedText type="small">{detail.itrFilings.length}</ThemedText>
                </View>
                {detail.itrFilings.length === 0 ? (
                  <ThemedText type="small">No ITR filings for this client yet.</ThemedText>
                ) : (
                  <View style={styles.list}>
                    {detail.itrFilings.map((f) => (
                      <FilingRow
                        key={f.id}
                        title={`${f.itrType} · AY ${f.assessmentYear}`}
                        subtitle={
                          f.filedDate
                            ? `Filed ${prettyDate(f.filedDate)}`
                            : f.dueDate
                              ? `Due ${prettyDate(f.dueDate)}`
                              : 'No due date recorded'
                        }
                        statusLabel={prettyStatus(f.status)}
                        tone={toneFor(f.status, f.dueDate, ITR_TERMINAL)}
                        footer={f.acknowledgementNumber ? `Ack ${f.acknowledgementNumber}` : null}
                        onPress={() => onOpenFiling({ clientId, filingId: f.id, kind: 'itr' })}
                      />
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <ThemedText type="subtitle">GST returns</ThemedText>
                  <ThemedText type="small">{detail.gstFilings.length}</ThemedText>
                </View>
                {detail.gstFilings.length === 0 ? (
                  <ThemedText type="small">No GST returns for this client.</ThemedText>
                ) : (
                  <View style={styles.list}>
                    {detail.gstFilings.map((f) => (
                      <FilingRow
                        key={f.id}
                        title={`${f.returnType} · ${formatPeriod(f.period) || 'Period not set'}`}
                        subtitle={
                          f.filedDate
                            ? `Filed ${prettyDate(f.filedDate)}`
                            : f.dueDate
                              ? `Due ${prettyDate(f.dueDate)}`
                              : 'No due date recorded'
                        }
                        statusLabel={prettyStatus(f.status)}
                        tone={toneFor(f.status, f.dueDate, GST_TERMINAL)}
                        footer={f.acknowledgementNumber ? `Ack ${f.acknowledgementNumber}` : null}
                        onPress={() => onOpenFiling({ clientId, filingId: f.id, kind: 'gst' })}
                      />
                    ))}
                  </View>
                )}
              </View>
            </>
          ) : null}
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
    paddingTop: Spacing.two,
    gap: Spacing.four,
  },
  header: { gap: 2 },
  card: { borderRadius: Spacing.two, padding: Spacing.three, gap: Spacing.one },
  section: { gap: Spacing.two },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { gap: Spacing.two },
  errorBox: { borderRadius: Spacing.two, padding: Spacing.three, gap: Spacing.two },
});
