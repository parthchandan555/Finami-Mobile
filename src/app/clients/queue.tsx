import { router } from 'expo-router';

import TriageQueueScreen from '@/screens/queue';

export default function ClientsQueueRoute() {
  return (
    <TriageQueueScreen
      onOpenClient={(clientId) =>
        router.push({ pathname: '/clients/[clientId]', params: { clientId } })
      }
    />
  );
}
