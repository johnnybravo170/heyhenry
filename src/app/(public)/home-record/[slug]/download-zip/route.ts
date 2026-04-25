/**
 * GET /home-record/<slug>/download-zip
 *
 * Sister route to /download (PDF). Mints a fresh 5-minute signed URL
 * on the stored zip_path and 302-redirects.
 */

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data: row } = await admin
    .from('home_records')
    .select('zip_path')
    .eq('slug', slug)
    .single();

  if (!row || !(row as Record<string, unknown>).zip_path) {
    return new Response('ZIP not yet generated for this Home Record.', { status: 404 });
  }

  const zipPath = (row as Record<string, unknown>).zip_path as string;
  const { data: signed, error } = await admin.storage
    .from('home-record-zips')
    .createSignedUrl(zipPath, 300);

  if (error || !signed?.signedUrl) {
    return new Response('Failed to mint download URL.', { status: 500 });
  }

  redirect(signed.signedUrl);
}
