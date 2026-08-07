import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { FilingRow, type FilingTone } from '@/features/clients/FilingRow';
import { fetchClientDetail, type ClientDetail } from '@/lib/clients/detail';
import { createDocumentSignedUrl, rendersInline } from '@/lib/clients/document-url';
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

function prettySize(bytes: number | null): string | null {
  if (bytes == null || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function docKind(fileType: string | null, fileName: string): string {
  const parts = fileName.split('.');
  const ext = parts.length > 1 ? parts[parts.length - 1] : '';
  if (ext && ext.length <= 4) return ext.toUpperCase();
  const sub = (fileType ?? '').split('/');
  const tail = sub[sub.length - 1];
  return tail ? tail.toUpperCase() : 'FILE';
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
  const { clientId, documentId } = useLocalSearchParams<{
    clientId: string;
    documentId?: string;
  }>();
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

  // Opening a document: the bucket is private, so we ask for a short-lived
  // signed URL and show it in the in-app browser sheet. Storage RLS decides
  // whether the URL is issued at all. A document whose object was never
  // uploaded fails here and is reported as unavailable rather than silently
  // doing nothing.
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);

  const onOpenDocument = useCallback(
    async (doc: {
      id: string;
      fileName: string;
      fileType: string | null;
      storagePath: string | null;
    }) => {
      if (openingDocId) return;
      setOpeningDocId(doc.id);
      try {
        if (!doc.storagePath) throw new Error('No file is attached to this record.');
        const url = await createDocumentSignedUrl(
          doc.storagePath,
          rendersInline(doc.fileType) ? null : doc.fileName,
        );
        await openBrowserAsync(url, { presentationStyle: WebBrowserPresentationStyle.AUTOMATIC });
      } catch {
        Alert.alert(doc.fileName, 'This file is not available.');
      } finally {
        setOpeningDocId(null);
      }
    },
    [openingDocId],
  );

  // C.14 - arrived from a document notification. Open that one document once,
  // after the list has resolved. The ref guard is what makes it once: this
  // effect re-runs whenever onOpenDocument's identity changes, and a
  // pull-to-refresh replaces `detail` entirely.
  //
  // A documentId that is not in this client's visible list - uploaded by us
  // and filtered out, or detached from the connection - lands on the screen
  // with nothing opened. That is deliberate: the alert belongs to a row the
  // person actually tapped, not to an arrival.
  const autoOpenedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!documentId || !detail) return;
    if (autoOpenedRef.current === documentId) return;
    const doc = detail.documents.find((d) => d.id === documentId);
    if (!doc) return;
    autoOpenedRef.current = documentId;
    onOpenDocument(doc);
  }, [documentId, detail, onOpenDocument]);

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

              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <ThemedText type="subtitle">Documents</ThemedText>
                  <ThemedText type="small">{detail.documents.length}</ThemedText>
                </View>
                {detail.documents.length === 0 ? (
                  <ThemedText type="small">No documents from this client yet.</ThemedText>
                ) : (
                  <View style={styles.list}>
                    {detail.documents.map((d) => (
                      <FilingRow
                        key={d.id}
                        title={d.fileName}
                        subtitle={
                          [d.category, prettySize(d.fileSize)].filter(Boolean).join(' · ') ||
                          'No details recorded'
                        }
                        statusLabel={docKind(d.fileType, d.fileName)}
                        tone="done"
                        footer={
                          [
                            d.assessmentYear ? `AY ${d.assessmentYear}` : null,
                            prettyDate(d.createdAt) ? `Uploaded ${prettyDate(d.createdAt)}` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ') || null
                        }
                        onPress={() => onOpenDocument(d)}
                      />
                    ))}
                  </View>
                )}
              </View>

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
                {detail.profile.designation ? (
                  <ThemedText type="small">{detail.profile.designation}</ThemedText>
                ) : null}
                {place ? <ThemedText type="small">{place}</ThemedText> : null}
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
  card: { borderRadius: Spacing.two, padding: Spacing.three, gap: Spacing.one },
  section: { gap: Spacing.two },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { gap: Spacing.two },
  errorBox: { borderRadius: Spacing.two, padding: Spacing.three, gap: Spacing.two },
});
