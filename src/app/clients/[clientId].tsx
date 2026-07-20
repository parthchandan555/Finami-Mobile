import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function ClientDetailScreen() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Client' }} />
      <View style={styles.body}>
        <ThemedText type="title">Client detail</ThemedText>
        <ThemedText type="small">{clientId}</ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: Spacing.three, gap: Spacing.two },
});
