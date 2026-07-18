import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { rankTriageItems } from '@/lib/ca-home/ranking';
import type { TriageItem } from '@/lib/ca-home/types';

import { TriageRow } from './TriageRow';
import { ZoneSection } from './ZoneSection';

/**
 * Zone 1 — always renders first, even when empty. The row cap never
 * silently truncates: overflow is computed from the honest total.
 */
export function AttentionQueue({
  items,
  trueTotal,
  onNavigate,
  emptyState,
  maxRows = 8,
}: {
  items: TriageItem[];
  trueTotal?: number;
  onNavigate: (href: string) => void;
  emptyState: React.ReactNode;
  maxRows?: number;
}) {
  const { rows, total, overflow } = rankTriageItems(items, maxRows, trueTotal);

  return (
    <ZoneSection title="Needs attention" badge={total > 0 ? String(total) : undefined}>
      {rows.length === 0 ? (
        emptyState
      ) : (
        <View style={styles.list}>
          {rows.map((item) => (
            <TriageRow key={item.id} item={item} onPress={onNavigate} />
          ))}
          {overflow > 0 ? (
            <Pressable onPress={() => onNavigate('compliance-calendar')} style={styles.overflow}>
              <ThemedText type="smallBold">{overflow} more need attention</ThemedText>
            </Pressable>
          ) : null}
        </View>
      )}
    </ZoneSection>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  overflow: { paddingVertical: Spacing.two },
});
