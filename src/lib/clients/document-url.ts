import { supabase } from '@/lib/supabase';

/**
 * Signed URL for one document in the private `documents` bucket.
 *
 * The bucket is private, so a signed URL is the only way to read an object.
 * Signing is checked against storage RLS: documents_bucket_party_select
 * requires the first path segment to be the id of an ACTIVE connection the
 * caller is a party to. That policy, not this file, is the security boundary.
 * Nothing here widens it.
 *
 * Throws on any failure, including a path with no object behind it. Most
 * seeded document rows point at fabricated paths that were never uploaded;
 * those throw here and the caller reports the file as unavailable.
 */
const BUCKET = 'documents';
const TTL_SECONDS = 60;

/**
 * MIME types iOS renders inside the in-app browser sheet.
 *
 * Anything outside this set was never going to render, so we ask Storage to
 * serve it under its real name instead of the storage UUID (C.13). The trade
 * is one way: asking for a name forces Content-Disposition attachment, which
 * would stop a PDF rendering inline. That is why this is an allowlist of what
 * renders and not a denylist of what does not - an unknown or missing type
 * gets the honest filename rather than a gamble.
 */
const INLINE_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'text/plain',
]);

export function rendersInline(fileType: string | null | undefined): boolean {
  return typeof fileType === 'string' && INLINE_MIME_TYPES.has(fileType.trim().toLowerCase());
}

export async function createDocumentSignedUrl(
  storagePath: string,
  downloadName?: string | null,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(
      storagePath,
      TTL_SECONDS,
      downloadName ? { download: downloadName } : undefined,
    );
  if (error) throw error;
  const url = data?.signedUrl;
  if (!url) throw new Error('No signed URL was returned.');
  return url;
}
