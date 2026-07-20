import React from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, Spacing } from '@/constants/theme';

export type FilingTone = 'done' | 'overdue' | 'open';

/**
 * One filing row. Read-only, not pressable — filing detail is not built.
 * Palette keys used here are all proven in shipped code (CA Home's TriageRow
 * and HorizonStrip already compile against accent / accentTint / destructive /
 * destructiveTint). No icons, matching the rest of the app.
 */
export function FilingRow({
  title,
  subtitle,
  statusLabel,
  tone,
  footer,
}: {
  title: string;
  subtitle: string;
  statusLabel: string;
  tone: FilingTone;
  footer?: string | null;
}) {
  const scheme: 'light' | 'dark' = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];

  const chip =
    tone === 'overdue'
      ? { bg: c.destructiveTint, fg: c.destructive }
      : tone === 'done'
        ? { bg: c.backgroundSelected, fg: c.text }
        : { bg: c.accentTint, fg: c.accent };

  return (
    <View style={[styles.row, { backgroundColor: c.backgroundElement }]}>
      <View style={styles.body}>
        <ThemedText type="smallBold" numberOfLines={1}>{title}</ThemedText>
        <ThemedText type="small" numberOfLines={2}>{subtitle}</ThemedText>
        {footer ? <ThemedText type="small" numberOfLines={1}>{footer}</ThemedText> : null}
      </View>
      <View style={[styles.chip, { backgroundColor: chip.bg }]}>
        <ThemedText type="small" style={[styles.chipText, { color: chip.fg }]}>
          {statusLabel}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  body: { flex: 1, gap: 2 },
  chip: {
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  chipText: { fontFamily: FontFamily.bold, fontSize: 11 },
});
