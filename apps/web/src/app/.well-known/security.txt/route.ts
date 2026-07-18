/**
 * /.well-known/security.txt. Points researchers/reporters at a role security
 * contact instead of a personal one — the operator-OPSEC half of this surface. Every value below
 * is a clearly-templated placeholder (the `.example` TLD is reserved by RFC 2606 and will never
 * resolve) until the pre-launch-operator-protection runbook's domain-registration and
 * role-mailbox steps are actually executed by a human; see
 * docs/runbooks/pre-launch-operator-protection.md. Swap PLACEHOLDER_DOMAIN and the contact
 * mailbox there, not just here, once the real domain exists.
 */
const PLACEHOLDER_DOMAIN = 'blackbook.example';
const PLACEHOLDER_SECURITY_CONTACT = `security@${PLACEHOLDER_DOMAIN}`;
const EXPIRES_WINDOW_DAYS = 365;

/** RFC 9116 requires an Expires field; this repo has no scheduler wired up yet (that is a
 * documented forward-reference in the runbook), so the value is computed relative to
 * request time as an interim measure — renew this file's cached copy at least yearly regardless. */
function expiresAt(now: Date): string {
  const expires = new Date(now.getTime());
  expires.setUTCDate(expires.getUTCDate() + EXPIRES_WINDOW_DAYS);
  return expires.toISOString();
}

function buildSecurityTxt(now: Date): string {
  const lines = [
    '# security.txt (RFC 9116) — Blap',
    '# TEMPLATE: every value below is a placeholder. Fill in the real role mailbox and domain',
    '# per docs/runbooks/pre-launch-operator-protection.md before this file is meaningful.',
    `Contact: mailto:${PLACEHOLDER_SECURITY_CONTACT}`,
    `Expires: ${expiresAt(now)}`,
    'Preferred-Languages: en',
    `Canonical: https://${PLACEHOLDER_DOMAIN}/.well-known/security.txt`,
  ];
  return lines.join('\r\n') + '\r\n';
}

export function GET(): Response {
  return new Response(buildSecurityTxt(new Date()), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
