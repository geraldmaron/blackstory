/**
 * Consent for an agent client (Claude Code, Codex) asking to act on the owner's management work
 * through /api/mcp. What an approved client can do is set elsewhere: request-auth.ts confines
 * its token to the work routes, approval of a proposal still needs a delegation, and the token is
 * refused outright unless its client id is in BLACKSTORY_MCP_ALLOWED_CLIENT_IDS.
 */
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DeskTitleBar } from '../../../../admin/design-system/ui';
import { staffRoleHasPermission } from '../../../../admin/auth/staff-permissions';
import {
  createAdminServerClient,
  readVerifiedAdminIdentity,
} from '../../../../admin/auth/supabase-server';
import { decideAuthorization } from './actions';

export const metadata: Metadata = { title: 'Approve an agent' };
export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  forbidden: 'Your role cannot approve agents. This needs research:write.',
  failed:
    'Supabase did not accept that decision. The request may have expired; start again from the agent.',
};

export default async function ConsentPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly authorization_id?: string; readonly error?: string }>;
}) {
  const { authorization_id: id = '', error } = await searchParams;
  const identity = await readVerifiedAdminIdentity();
  const notice = error ? ERRORS[error] : undefined;

  const shell = (body: React.ReactNode) => (
    <main className="ds-container ds-page" id="main">
      <DeskTitleBar eyebrow="Agent access" title="Approve an agent" />
      {notice ? (
        <p className="ds-notice ds-notice--error" role="alert">
          {notice}
        </p>
      ) : null}
      {body}
    </main>
  );

  if (!id) return shell(<p>This link has no authorization request. Start again from the agent.</p>);
  if (!identity || !staffRoleHasPermission(identity.role, 'research:write'))
    return shell(<p>Sign in with an account that can research to approve an agent.</p>);

  const client = await createAdminServerClient();
  const { data, error: lookup } = await client.auth.oauth.getAuthorizationDetails(id);
  if (lookup || !data)
    return shell(<p>This request has expired or was already used. Start again from the agent.</p>);
  // Already approved once: Supabase hands back the client's callback straight away.
  if (!('authorization_id' in data)) redirect(data.redirect_url);

  const allowed = (process.env.BLACKSTORY_MCP_ALLOWED_CLIENT_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .includes(data.client.id);

  return shell(
    <section className="story-review__detail" aria-label="Authorization request">
      <p className="ds-sans">
        <strong>{data.client.name || 'An unnamed client'}</strong> wants to act as{' '}
        <strong>{data.user.email}</strong> on BlackStory management work.
      </p>
      <ul className="ds-sans">
        <li>
          It can list, research and propose changes to work requests. It cannot approve or publish
          anything without you.
        </li>
        <li>
          It returns to <code>{data.redirect_uri}</code>. Only approve if you started this from that
          agent just now.
        </li>
        <li>Scopes requested: {data.scope || 'none'}.</li>
      </ul>
      <p className="ds-sans">
        Client ID <code>{data.client.id}</code>{' '}
        {allowed
          ? 'is on the allowlist.'
          : 'is not on the allowlist yet, so BlackStory will refuse its token until this ID is added to BLACKSTORY_MCP_ALLOWED_CLIENT_IDS.'}
      </p>
      <form action={decideAuthorization} className="entity-edit__actions">
        <input type="hidden" name="authorizationId" value={id} />
        <button type="submit" name="decision" value="approve" className="ds-button">
          Approve
        </button>
        <button
          type="submit"
          name="decision"
          value="deny"
          className="ds-button ds-button--secondary"
        >
          Deny
        </button>
      </form>
    </section>,
  );
}
