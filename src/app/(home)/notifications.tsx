import { router } from 'expo-router';

import NotificationsScreen from '@/screens/notifications';

export default function NotificationsRoute() {
  return (
    <NotificationsScreen
      onOpenClient={(clientId, documentId) =>
        router.push({
          pathname: '/client/[clientId]',
          params: documentId ? { clientId, documentId } : { clientId },
        })
      }
    />
  );
}
