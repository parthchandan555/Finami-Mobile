import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/** Zone wrapper — title row + content. Mobile equivalent of the web ZoneSection. */
export function ZoneSection({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.zone}>
      <View style={styles.header}>
        <ThemedText type="subtitle">{title}</ThemedText>
        {badge ? <ThemedText type="smallBold">{badge}</ThemedText> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { gap: Spacing.two, alignSelf: 'stretch' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
