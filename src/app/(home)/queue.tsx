import { router } from 'expo-router';

import TriageQueueScreen from '@/screens/queue';

export default function HomeQueueRoute() {
  return (
    <TriageQueueScreen
      onOpenClient={(clientId) => router.push({ pathname: '/client/[clientId]', params: { clientId } })}
    />
  );
}
