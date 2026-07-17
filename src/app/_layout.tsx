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
