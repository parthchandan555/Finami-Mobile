import React from 'react';
import { Pressable, StyleSheet, View, useColorScheme } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import type { ClientListEntry } from '@/lib/clients/data';

/**
 * One client row. No icons (unaudited for RN). The edge bar uses
 * `backgroundSelected` rather than an accent key, because only the palette
 * keys already proven in index.tsx/app-tabs were used here — no guessed
 * identifiers. `city` is optional in live data, so the subtitle is conditional.
 */
export function ClientRow({ entry, onPress }: { entry: ClientListEntry; onPress?: () => void }) {
  const scheme: 'light' | 'dark' = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={entry.name}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? c.backgroundSelected : c.backgroundElement },
      ]}
    >
      <View style={[styles.edge, { backgroundColor: c.backgroundSelected }]} />
      <View style={styles.body}>
        <ThemedText type="smallBold">{entry.name}</ThemedText>
        {entry.city ? <ThemedText type="small">{entry.city}</ThemedText> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: Spacing.two,
    overflow: 'hidden',
    minHeight: 56,
  },
  edge: { width: 4 },
  body: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    justifyContent: 'center',
    gap: 2,
  },
});
