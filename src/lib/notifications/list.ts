import { supabase } from '@/lib/supabase';

/**
 * In-app notification list data layer — read-only.
 *
 * User-scoped, NOT connection/persona-scoped: this is an inbox of every
 * notification for the signed-in user. testpro1 has both CA and RA
 * notifications; there is no `service_type` filter, unlike the CA surfaces.
 *
 * RLS on `notifications` already restricts SELECT to the owner
 * (`auth.uid()::text = user_id`); the explicit `.eq('user_id', ...)` mirrors
 * the client-list convention and is belt-and-suspenders.
 *
 * `message` is rendered verbatim. Some rows (e.g. ra_basket_payment) carry a
 * pre-formatted rupee amount inside the string — that is display text, NOT a
 * money column, and must never be parsed or reformatted.
 */
export interface NotificationEntry {
  id: string;
  type: string;
  title: string;
  message: string;
  /** `is_read` is nullable in the DB; absent is treated as unread. */
  isRead: boolean;
  createdAt: string | null;
}

export async function fetchNotifications(userId: string): Promise<NotificationEntry[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, message, is_read, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as {
    id: string;
    type: string;
    title: string;
    message: string;
    is_read: boolean | null;
    created_at: string | null;
  }[];

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    message: r.message,
    isRead: r.is_read ?? false,
    createdAt: r.created_at ?? null,
  }));
}
