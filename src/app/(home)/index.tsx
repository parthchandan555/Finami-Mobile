import { router } from 'expo-router';

import CaHomeScreen from '@/screens/ca-home';

export default function HomeRoute() {
  return (
    <CaHomeScreen
      onOpenQueue={() => router.push({ pathname: '/queue' })}
      onOpenClient={(clientId) => router.push({ pathname: '/client/[clientId]', params: { clientId } })}
      onOpenNotifications={() => router.push({ pathname: '/notifications' })}
      onOpenAbout={() => router.push({ pathname: '/about' })}
    />
  );
}
