import React from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

/** One "Pulse" stat chip. De-emphasis via size/weight only — never grey. */
export function PulseChip({ label, value }: { label: string; value: string | number }) {
  const scheme: 'light' | 'dark' = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  return (
    <View style={[styles.chip, { backgroundColor: c.backgroundElement }]}>
      <ThemedText type="title" style={styles.value}>
        {String(value)}
      </ThemedText>
      <ThemedText type="small">{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minWidth: 96,
    flexGrow: 1,
    gap: Spacing.half,
  },
  value: { fontSize: 24, lineHeight: 30 },
});
