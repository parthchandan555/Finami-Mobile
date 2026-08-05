import { supabase } from '@/lib/supabase';

/**
 * Releases this device's push token at sign out.
 *
 * Goes through the `release_push_token()` SECURITY DEFINER RPC rather than a
 * direct `.delete()` on `push_tokens`. An owner scoped DELETE policy does
 * exist, so a direct delete would work today, but `push_tokens` still carries
 * blanket table grants that are due to be revoked. The RPC keeps mobile off
 * those grants, and its `user_id = auth.uid()::text` predicate IS the security
 * boundary because SECURITY DEFINER bypasses RLS entirely.
 *
 * Returns 1 when the row was removed, 0 otherwise. A non owner, an unknown
 * token, and an already released token all return 0, deliberately
 * indistinguishable, so the count is not an existence oracle. Callers must NOT
 * treat 0 as a failure.
 */
export async function releasePushToken(token: string): Promise<number> {
  const { data, error } = await supabase.rpc('release_push_token', {
    p_token: token,
  });
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}
