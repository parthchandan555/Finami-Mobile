import React from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View, useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';

/**
 * About / legal. Publishes the operator of the app, the registered office,
 * the support contact and the running version, and carries sign out.
 *
 * Every string below is a published legal fact. It must match what
 * finamize.com/privacy and finamize.com/terms say. Change one, change both.
 */
const COMPANY = 'Allumer Fintech Private Limited';
const CIN = 'U66190PN2025PTC240927';
const REGISTERED_OFFICE =
  '104, Gera Chambers, F.P. No. 204, Boat Club Road, Pune \u2013 411001, Maharashtra';
const SUPPORT_EMAIL = 'support@allumerfintech.com';
const GRIEVANCE_EMAIL = 'grievance.finamize@allumerfintech.com';
const PRIVACY_URL = 'https://finamize.com/privacy';
const TERMS_URL = 'https://finamize.com/terms';

function appVersion(): string {
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const build = Constants.platform?.ios?.buildNumber;
  return build ? `${version} (${build})` : version;
}

export default function AboutScreen() {
  const scheme: 'light' | 'dark' = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const { signOut } = useAuth();

  const open = (url: string, fallback: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Could not open this', fallback);
    });
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'About' }} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <ThemedText type="smallBold">Support</ThemedText>
            <View style={[styles.card, { backgroundColor: c.backgroundElement }]}>
              <LinkRow
                label="Email us"
                value={SUPPORT_EMAIL}
                onPress={() => open('mailto:' + SUPPORT_EMAIL, SUPPORT_EMAIL)}
                stacked
              />
              <LinkRow
                label="Grievance officer"
                value={GRIEVANCE_EMAIL}
                onPress={() => open('mailto:' + GRIEVANCE_EMAIL, GRIEVANCE_EMAIL)}
                stacked
              />
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold">Legal</ThemedText>
            <View style={[styles.card, { backgroundColor: c.backgroundElement }]}>
              <LinkRow
                label="Privacy policy"
                value="finamize.com/privacy"
                onPress={() => open(PRIVACY_URL, PRIVACY_URL)}
              />
              <LinkRow
                label="Terms of service"
                value="finamize.com/terms"
                onPress={() => open(TERMS_URL, TERMS_URL)}
              />
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold">Company</ThemedText>
            <View style={[styles.card, { backgroundColor: c.backgroundElement }]}>
              <Row label="Operated by" value={COMPANY} stacked />
              <Row label="CIN" value={CIN} stacked />
              <Row label="Registered office" value={REGISTERED_OFFICE} stacked />
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold">App</ThemedText>
            <View style={[styles.card, { backgroundColor: c.backgroundElement }]}>
              <Row label="Version" value={appVersion()} />
            </View>
          </View>

          <Pressable
            onPress={signOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            style={({ pressed }) => [
              styles.signOut,
              { backgroundColor: c.destructiveTint, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <ThemedText type="smallBold" style={{ color: c.destructive }}>
              Sign out
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Row({ label, value, stacked }: { label: string; value: string; stacked?: boolean }) {
  return (
    <View style={stacked ? styles.stackedRow : styles.row}>
      <ThemedText type="small">{label}</ThemedText>
      <ThemedText type="smallBold" style={stacked ? undefined : styles.rowValue}>
        {value}
      </ThemedText>
    </View>
  );
}

function LinkRow({
  label,
  value,
  onPress,
  stacked,
}: {
  label: string;
  value: string;
  onPress: () => void;
  stacked?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      style={({ pressed }) => [
        stacked ? styles.stackedRow : styles.row, { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <ThemedText type="small">{label}</ThemedText>
      <ThemedText type="linkPrimary" style={stacked ? undefined : styles.rowValue}>
        {value}
      </ThemedText>
    </Pressable>
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
  section: { gap: Spacing.one },
  card: { borderRadius: Spacing.two, padding: Spacing.three, gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  rowValue: { flexShrink: 1, textAlign: 'right' },
  stackedRow: { gap: 2 },
  signOut: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    alignItems: 'center',
  },
});
