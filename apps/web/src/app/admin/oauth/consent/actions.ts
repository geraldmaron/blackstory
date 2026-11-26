'use server';

/**
 * Approve or deny one OAuth authorization from an agent client (Claude Code, Codex). Runs on the
 * server because the page's content security policy keeps the browser off supabase.co. Supabase
 * checks that the signed-in user owns the authorization; this adds the staff-role check.
 */
import { redirect } from 'next/navigation';
import {
  createAdminServerClient,
  readVerifiedAdminIdentity,
} from '../../../../admin/auth/supabase-server';
import { staffRoleHasPermission } from '../../../../admin/auth/staff-permissions';

export async function decideAuthorization(formData: FormData): Promise<void> {
  const id = String(formData.get('authorizationId') ?? '');
  const approve = formData.get('decision') === 'approve';
  const identity = await readVerifiedAdminIdentity();
  if (!identity || !staffRoleHasPermission(identity.role, 'research:write')) {
    redirect(`/admin/oauth/consent?authorization_id=${encodeURIComponent(id)}&error=forbidden`);
  }
  const client = await createAdminServerClient();
  const options = { skipBrowserRedirect: true };
  const { data, error } = approve
    ? await client.auth.oauth.approveAuthorization(id, options)
    : await client.auth.oauth.denyAuthorization(id, options);
  if (error || !data?.redirect_url) {
    redirect(`/admin/oauth/consent?authorization_id=${encodeURIComponent(id)}&error=failed`);
  }
  // Back to the client's own registered callback, which Supabase built and checked.
  redirect(data.redirect_url);
}
