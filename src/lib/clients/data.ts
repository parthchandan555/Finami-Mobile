import { supabase } from '@/lib/supabase';

/**
 * Client list data layer — read-only.
 *
 * Scope is deliberately CA + ACTIVE only:
 *  - `service_type = 'CA'` matches CA Home's contract. testpro1 also holds 10
 *    ACTIVE 'RA' connections; those belong to an RA surface, not this one.
 *  - `status = 'ACTIVE'` is load-bearing for names. The `public_profiles` view
 *    only resolves a client's name when an ACTIVE connection exists, so a
 *    non-ACTIVE entry would render as "Unknown client" by construction.
 *
 * Two-stage fetch, same shape as the verified web `ClientsView` read path:
 * connections first, then names for the resolved id list.
 */
export interface ClientListEntry {
  clientId: string;
  name: string;
  /** Null for some clients live (2 of 44 for testpro1) — never assume present. */
  city: string | null;
  connectedAt: string | null;
}

export async function fetchClientList(userId: string): Promise<ClientListEntry[]> {
  const { data: conns, error: connError } = await supabase
    .from('connections')
    .select('client_id, connected_at, created_at')
    .eq('professional_id', userId)
    .eq('service_type', 'CA')
    .eq('status', 'ACTIVE');

  if (connError) throw connError;

  const rows = (conns ?? []) as { client_id: string | null; connected_at: string | null; created_at: string | null }[];
  const ids = Array.from(new Set(rows.map((r) => r.client_id).filter((v): v is string => !!v)));
  if (ids.length === 0) return [];

  const { data: profiles, error: profError } = await supabase
    .from('public_profiles')
    .select('user_id, name, city')
    .in('user_id', ids);

  if (profError) throw profError;

  const byId = new Map<string, { name: string | null; city: string | null }>();
  for (const p of (profiles ?? []) as { user_id: string; name: string | null; city: string | null }[]) {
    byId.set(p.user_id, { name: p.name, city: p.city });
  }

  const entries: ClientListEntry[] = rows
    .filter((r): r is { client_id: string; connected_at: string | null; created_at: string | null } => !!r.client_id)
    .map((r) => {
      const p = byId.get(r.client_id);
      return {
        clientId: r.client_id,
        name: p?.name ?? 'Unknown client',
        city: p?.city ?? null,
        connectedAt: r.connected_at ?? r.created_at ?? null,
      };
    });

  entries.sort((a, b) => a.name.localeCompare(b.name));
  return entries;
}
