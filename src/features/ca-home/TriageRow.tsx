import React from 'react';
import { Pressable, StyleSheet, View, useColorScheme } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import type { TriageItem, TriageTier } from '@/lib/ca-home/types';

/**
 * One attention-queue row. The web version renders a Material Symbols icon;
 * icons are not yet audited for RN (project instructions §6), so tier is
 * carried by a colored edge bar from the locked palette instead:
 *   T1 = destructive, T2 = warning, T3 = accent, T4 = no edge.
 * Chip label ("OVERDUE 3d" / "TODAY" / "4d") sits right, tinted to match.
 */
function tierColors(tier: TriageTier, c: (typeof Colors)[keyof typeof Colors]) {
  switch (tier) {
    case 'T1':
      return { edge: c.destructive, chipBg: c.destructiveTint, chipFg: c.destructive };
    case 'T2':
      return { edge: c.warning, chipBg: c.warningTint, chipFg: c.warning };
    case 'T3':
      return { edge: c.accent, chipBg: c.accentTint, chipFg: c.accent };
    default:
      return { edge: 'transparent', chipBg: c.backgroundSelected, chipFg: c.text };
  }
}

export function TriageRow({ item, onPress }: { item: TriageItem; onPress: (href: string) => void }) {
  const scheme: 'light' | 'dark' = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const t = tierColors(item.tier, c);

  return (
    <Pressable
      onPress={() => onPress(item.href)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? c.backgroundSelected : c.backgroundElement },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.whyLine}`}
    >
      <View style={[styles.edge, { backgroundColor: t.edge }]} />
      <View style={styles.body}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {item.title}
        </ThemedText>
        <ThemedText type="small" numberOfLines={2}>
          {item.whyLine}
        </ThemedText>
      </View>
      {item.chipLabel ? (
        <View style={[styles.chip, { backgroundColor: t.chipBg }]}>
          <ThemedText type="small" style={[styles.chipText, { color: t.chipFg }]}>
            {item.chipLabel}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.two,
    overflow: 'hidden',
    gap: Spacing.two,
    paddingRight: Spacing.two,
  },
  edge: { width: 4, alignSelf: 'stretch' },
  body: { flex: 1, paddingVertical: Spacing.two, gap: 2 },
  chip: {
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  chipText: { fontFamily: FontFamily.bold, fontSize: 11 },
});
