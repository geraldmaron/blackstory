/**
 * Supabase's OAuth server sends the owner here (Site URL + Authorization Path) to approve an
 * agent client. The page itself lives under /admin so the admin sign-in gate covers it.
 */
export function GET(request: Request): Response {
  const id = new URL(request.url).searchParams.get('authorization_id') ?? '';
  const target = new URL('/admin/oauth/consent', request.url);
  if (id) target.searchParams.set('authorization_id', id);
  return Response.redirect(target, 303);
}
