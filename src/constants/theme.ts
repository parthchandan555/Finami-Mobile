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
