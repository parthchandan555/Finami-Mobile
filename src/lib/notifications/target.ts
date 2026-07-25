/**
 * Notification tap-target resolver — pure, no I/O.
 *
 * Maps a notification's `data` jsonb (as returned by the DB) onto a mobile
 * navigation target, or null when the notification is not deep-linkable in v1.
 *
 * THE ONE PRINCIPLE (see notification-data-enrichment-spec.md):
 * the sender ships semantic identifiers, the app owns routing. Web writes
 * WHICH record a notification is about into `notifications.data`; it never
 * writes a mobile path. This function is the entire "app owns routing" half.
 *
 * v1 resolves exactly one target: a client detail screen, keyed off
 * `client_id`. Everything else returns null and the row stays non-tappable.
 *
 * DELIBERATE: we key off `client_id` ALONE and ignore the `entity` label the
 * spec also asks web to write. `entity` is a redundant classifier; if web
 * ships the id but omits the label, a strict `entity === 'client'` check would
 * make a perfectly routable row silently non-tappable. Be strict on the field
 * we actually use, lenient on the label we don't.
 *
 * The client-facing `connection` variant carries `professional_id` and no
 * `client_id` (mobile has no professional-detail screen in v1), so it
 * correctly falls through to null here.
 *
 * `client_id` is `profiles.user_id`, which is TEXT and NOT always uuid-shaped
 * (live data includes ids like `seed-stress-test-v1-arch2-5`). Treat it as an
 * opaque string; never validate it as a uuid.
 */
export type NotificationTarget = { kind: 'client'; clientId: string };

export function resolveNotificationTarget(data: unknown): NotificationTarget | null {
  if (!data || typeof data !== 'object') return null;
  const clientId = (data as Record<string, unknown>).client_id;
  if (typeof clientId === 'string' && clientId.length > 0) {
    return { kind: 'client', clientId };
  }
  return null;
}
