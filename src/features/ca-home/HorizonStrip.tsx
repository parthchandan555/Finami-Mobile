import React from 'react';
import { ScrollView, StyleSheet, View, useColorScheme } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import type { HorizonDay } from '@/lib/ca-home/types';

import { ZoneSection } from './ZoneSection';

/** Zone 2 — next 14 days as a compact horizontal date rail. */
export function HorizonStrip({ days }: { days: HorizonDay[] }) {
  const scheme: 'light' | 'dark' = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];

  return (
    <ZoneSection title="Next 14 days">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {days.map((d) => {
          const active = d.count > 0;
          return (
            <View
              key={d.date}
              style={[
                styles.bubble,
                { backgroundColor: active ? c.accentTint : c.backgroundElement },
              ]}
            >
              <ThemedText type="small" style={styles.dow}>
                {d.dow.toUpperCase()}
              </ThemedText>
              <ThemedText type="smallBold">{d.label}</ThemedText>
              {active ? (
                <ThemedText type="small" style={[styles.count, { color: c.accent }]}>
                  {d.count}
                </ThemedText>
              ) : (
                <View style={styles.countSpacer} />
              )}
            </View>
          );
        })}
      </ScrollView>
    </ZoneSection>
  );
}

const styles = StyleSheet.create({
  rail: { gap: Spacing.two, paddingVertical: Spacing.half },
  bubble: {
    minWidth: 58,
    alignItems: 'center',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    gap: 2,
  },
  dow: { fontFamily: FontFamily.bold, fontSize: 10, letterSpacing: 0.5 },
  count: { fontFamily: FontFamily.bold, fontSize: 12 },
  countSpacer: { height: 16 },
});
