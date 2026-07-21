import { router } from 'expo-router';

import ClientDetailScreen from '@/screens/client-detail';

export default function HomeClientDetailRoute() {
  return (
    <ClientDetailScreen
      onOpenFiling={({ clientId, filingId, kind }) =>
        router.push({ pathname: '/client/filing', params: { clientId, filingId, kind } })
      }
    />
  );
}
