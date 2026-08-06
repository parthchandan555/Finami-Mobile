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

export async function createDocumentSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, TTL_SECONDS);
  if (error) throw error;
  const url = data?.signedUrl;
  if (!url) throw new Error('No signed URL was returned.');
  return url;
}
