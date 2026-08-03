import React from 'react';
import { Pressable, StyleSheet, View, useColorScheme } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import type { NotificationEntry } from '@/lib/notifications/list';

/**
 * One notification-list row. Becomes pressable when the notification either
 * resolves to a navigation target (v1: a client detail screen, keyed off
 * `data.client_id`) OR is still unread, because tapping an unread row marks
 * it read. A row that is both read and untargeted has nothing to do — no
 * press handler, no affordance. Routing itself is owned by the caller via
 * `onPress`; this component holds no path literal and performs no write. Unread state is carried
 * by a colored edge bar, mirroring the
 * CA-home tier pattern (TriageRow): unread = accent edge, read = no edge.
 * `message` renders verbatim — some rows carry a pre-formatted rupee amount
 * inside the string; that is display text, NOT a money column, and must
 * never be parsed or reformatted.
 */
export function NotificationRow({
  item,
  onPress,
}: {
  item: NotificationEntry;
  onPress?: (item: NotificationEntry) => void;
}) {
  const scheme: 'light' | 'dark' = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];

  const tappable = onPress != null && (item.target != null || !item.isRead);

  const inner = (
    <>
      <View style={[styles.edge, { backgroundColor: item.isRead ? 'transparent' : c.accent }]} />
      <View style={styles.body}>
        <ThemedText type="smallBold" numberOfLines={2}>
          {item.title}
        </ThemedText>
        <ThemedText type="small" numberOfLines={4}>
          {item.message}
        </ThemedText>
        <ThemedText type="small">{formatRelativeTime(item.createdAt)}</ThemedText>
      </View>
    </>
  );

  if (tappable) {
    return (
      <Pressable
        onPress={() => onPress!(item)}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: c.backgroundElement, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        {inner}
      </Pressable>
    );
  }

  return <View style={[styles.row, { backgroundColor: c.backgroundElement }]}>{inner}</View>;
}

/**
 * Coarse relative time — "Just now" / "12m ago" / "3h ago" / "5d ago", then a
 * plain date past a week. No date library; display-only, no calendar
 * precision required.
 */
function formatRelativeTime(createdAt: string | null): string {
  if (!createdAt) return '';
  const then = new Date(createdAt).getTime();
  if (Number.isNaN(then)) return '';
  const diffMin = Math.floor((Date.now() - then) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: Spacing.two,
    overflow: 'hidden',
    gap: Spacing.two,
    paddingRight: Spacing.two,
  },
  edge: { width: 4, alignSelf: 'stretch' },
  body: { flex: 1, paddingVertical: Spacing.two, gap: Spacing.half },
});
