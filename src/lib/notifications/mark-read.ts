import { supabase } from '@/lib/supabase';

/**
 * THE ONLY MOBILE WRITE TO A BUSINESS TABLE IN V1.
 *
 * Every other v1 surface is read-only. The only other writes from mobile are
 * auth and `register_push_token()`. This is a deliberate, named break in the
 * read-only-except-auth rule, not an implementation convenience.
 *
 * It goes through the `mark_all_notifications_read()` SECURITY DEFINER RPC
 * rather than a direct `.update()` on `notifications`. RLS is row-level, not
 * column-level: a direct update would grant any authenticated session the
 * ability to rewrite `title`, `message`, `type`, `link` and `data` on its own
 * rows. The RPC touches only `is_read` and `read_at`, and its
 * `user_id = auth.uid()::text` predicate IS the security boundary, because
 * SECURITY DEFINER bypasses RLS entirely.
 *
 * Returns the number of rows marked. A caller with nothing unread and a
 * caller who owns nothing both get 0, so the count leaks nothing.
 */
export async function markAllNotificationsRead(): Promise<number> {
  const { data, error } = await supabase.rpc('mark_all_notifications_read');
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}
