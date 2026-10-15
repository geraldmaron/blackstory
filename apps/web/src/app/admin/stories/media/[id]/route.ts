import { readVerifiedAdminIdentity } from '@/admin/auth/supabase-server';
import { readEditorialMedia } from '@/admin/editorial/media';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await readVerifiedAdminIdentity())) return new Response(null, { status: 401 });
  const media = await readEditorialMedia((await params).id);
  if (!media) return new Response(null, { status: 404 });
  return new Response(media.bytes, {
    headers: {
      'Content-Type': media.contentType,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
