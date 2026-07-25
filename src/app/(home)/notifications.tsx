import { router } from 'expo-router';

import NotificationsScreen from '@/screens/notifications';

export default function NotificationsRoute() {
  return (
    <NotificationsScreen
      onOpenClient={(clientId) =>
        router.push({ pathname: '/client/[clientId]', params: { clientId } })
      }
    />
  );
}
