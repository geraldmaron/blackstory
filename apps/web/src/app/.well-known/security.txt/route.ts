/**
 * /.well-known/security.txt — the reachable contact for vulnerability reports.
 *
 * `SECURITY_CONTACT` is currently a personal mailbox. The operator-OPSEC intent recorded in
 * docs/runbooks/pre-launch-operator-protection.md is a *role* mailbox (security@blackstory.app)
 * so reports do not tie to an individual; move it there once that mailbox exists and set
 * SECURITY_TXT_CONTACT rather than editing this file again.
 */
const SITE_DOMAIN = 'blackstory.app';
const SECURITY_CONTACT = process.env.SECURITY_TXT_CONTACT?.trim() || 'me@geralddagher.com';
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
    '# security.txt (RFC 9116) — BlackStory',
    `Contact: mailto:${SECURITY_CONTACT}`,
    `Expires: ${expiresAt(now)}`,
    'Preferred-Languages: en',
    `Canonical: https://${SITE_DOMAIN}/.well-known/security.txt`,
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
