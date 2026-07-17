#!/usr/bin/env bash
# Finamize Mobile — chat 3 design-token port. Rewrites 5 files, then typechecks.
set -u
cd ~/Projects/Finami-Mobile || { echo "ABORT: ~/Projects/Finami-Mobile not found"; exit 1; }
grep -q "\"name\": \"finami-mobile\"" package.json || { echo "ABORT: not the Finami-Mobile repo"; exit 1; }
echo "Repo confirmed. Writing files..."

mkdir -p "$(dirname src/constants/theme.ts)"
cat > src/constants/theme.ts << 'PJS_APPLY_EOF_7f3a'
/**
 * Finamize design tokens. Locked palette per project instructions §6.
 * accent / accentSecondary / destructive / warning / success are identical
 * across both themes. Secondary text is full-contrast foreground (NO grey
 * text) — de-emphasis comes from size/weight in the type ladder, never
 * opacity. The 16% tint backgrounds are precomputed as static hex (RN has no
 * color-mix): each token color at 16% alpha composited over the theme bg.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    textSecondary: '#000000',
    background: '#FFFFFF',
    backgroundElement: '#F2F2F7',
    backgroundSelected: '#E5E5EA',
    accent: '#0A84FF',
    accentSecondary: '#7C6FE3',
    destructive: '#FF453A',
    warning: '#FF9F0A',
    success: '#30D158',
    accentTint: '#D8EBFF',
    accentSecondaryTint: '#EAE8FB',
    destructiveTint: '#FFE1DF',
    warningTint: '#FFF0D8',
    successTint: '#DEF8E4',
  },
  dark: {
    text: '#FFFFFF',
    textSecondary: '#FFFFFF',
    background: '#080808',
    backgroundElement: '#121212',
    backgroundSelected: '#1A1A1A',
    accent: '#0A84FF',
    accentSecondary: '#7C6FE3',
    destructive: '#FF453A',
    warning: '#FF9F0A',
    success: '#30D158',
    accentTint: '#081C30',
    accentSecondaryTint: '#1B182B',
    destructiveTint: '#301210',
    warningTint: '#302008',
    successTint: '#0E2815',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** Plus Jakarta Sans weight families (loaded in src/app/_layout.tsx). */
export const FontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: 'PlusJakartaSans_400Regular',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'PlusJakartaSans_400Regular',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
PJS_APPLY_EOF_7f3a
echo "  wrote src/constants/theme.ts"

mkdir -p "$(dirname src/components/themed-text.tsx)"
cat > src/components/themed-text.tsx << 'PJS_APPLY_EOF_7f3a'
import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { FontFamily, Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FontFamily.medium,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FontFamily.bold,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: FontFamily.medium,
  },
  title: {
    fontSize: 48,
    lineHeight: 52,
    fontFamily: FontFamily.bold,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontFamily: FontFamily.semibold,
  },
  link: {
    fontSize: 14,
    lineHeight: 30,
    fontFamily: FontFamily.medium,
  },
  linkPrimary: {
    fontSize: 14,
    lineHeight: 30,
    fontFamily: FontFamily.semibold,
    color: '#0A84FF',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
PJS_APPLY_EOF_7f3a
echo "  wrote src/components/themed-text.tsx"

mkdir -p "$(dirname src/screens/login.tsx)"
cat > src/screens/login.tsx << 'PJS_APPLY_EOF_7f3a'
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FontFamily } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    const res = await signIn(email, password);
    setBusy(false);
    if (res.error) setError(res.error);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.box}>
        <Text style={[styles.title, { color: theme.text }]}>Finamize</Text>
        <Text style={[styles.sub, { color: theme.text }]}>Sign in to continue</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
          placeholder="Email"
          placeholderTextColor={theme.text}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
          placeholder="Password"
          placeholderTextColor={theme.text}
          secureTextEntry
          textContentType="password"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={onSubmit}
        />
        {error ? <Text style={[styles.error, { color: theme.destructive }]}>{error}</Text> : null}
        <Pressable
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.accent },
            pressed && styles.pressed,
          ]}
          onPress={onSubmit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center' },
  box: { paddingHorizontal: 28, gap: 12 },
  title: { fontSize: 32, fontFamily: FontFamily.bold, textAlign: 'center' },
  sub: { fontSize: 15, fontFamily: FontFamily.medium, textAlign: 'center', marginBottom: 16 },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: FontFamily.medium,
  },
  error: { fontSize: 14, fontFamily: FontFamily.medium, textAlign: 'center' },
  button: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  pressed: { opacity: 0.7 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontFamily: FontFamily.semibold },
});
PJS_APPLY_EOF_7f3a
echo "  wrote src/screens/login.tsx"

mkdir -p "$(dirname src/app/_layout.tsx)"
cat > src/app/_layout.tsx << 'PJS_APPLY_EOF_7f3a'
import { useFonts } from 'expo-font';
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AuthProvider, useAuth } from '@/context/auth';
import LoginScreen from '@/screens/login';

SplashScreen.preventAutoHideAsync();

// TEMP-REMOVE-BEFORE-CA-HOME: floating logout for auth testing only.
function TempLogout() {
  const { signOut } = useAuth();
  return (
    <View style={tempStyles.wrap} pointerEvents="box-none">
      <Pressable style={tempStyles.btn} onPress={signOut}>
        <Text style={tempStyles.txt}>Log out (temp)</Text>
      </Pressable>
    </View>
  );
}

function Gate() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (!session) return <LoginScreen />;
  return (
    <>
      <AppTabs />
      <TempLogout />
    </>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AnimatedSplashOverlay />
        <Gate />
      </AuthProvider>
    </ThemeProvider>
  );
}

const tempStyles = StyleSheet.create({
  wrap: { position: 'absolute', top: 64, right: 16 },
  btn: {
    backgroundColor: '#FF453A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  txt: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
});
PJS_APPLY_EOF_7f3a
echo "  wrote src/app/_layout.tsx"

mkdir -p "$(dirname src/types/expo-google-fonts.d.ts)"
cat > src/types/expo-google-fonts.d.ts << 'PJS_APPLY_EOF_7f3a'
// Subpath imports (e.g. '@expo-google-fonts/plus-jakarta-sans/400Regular')
// resolve at runtime but the package may not ship subpath type declarations.
// This ambient wildcard keeps tsc happy without loosening anything else.
declare module '@expo-google-fonts/plus-jakarta-sans/*';
PJS_APPLY_EOF_7f3a
echo "  wrote src/types/expo-google-fonts.d.ts"

echo ""
echo "All files written. Running typecheck (npx tsc --noEmit)..."
echo "-----------------------------------------------------------"
npx tsc --noEmit && echo "TYPECHECK: PASS" || echo "TYPECHECK: FAIL (see errors above)"
