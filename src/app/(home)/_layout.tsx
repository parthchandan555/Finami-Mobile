import { Stack } from 'expo-router';

export const unstable_settings = { initialRouteName: 'index' };

export default function HomeLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Home' }} />
    </Stack>
  );
}
