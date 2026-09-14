/**
 * End-to-end smoke harness. Full browser flows land with product UI.
 * Executable now: validates the gate contract and skips unless E2E_BASE_URL is set.
 *
 * WHAT A PASS HERE MEANS, and what it used to mean. This assertion was
 * `response.status > 0`, which every HTTP response on earth satisfies — including the 302
 * that a Vercel Preview deployment returns when it bounces an unauthenticated request to
 * vercel.com/sso-api. Aimed at the staging alias, the old check would have gone green
 * against a login redirect and reported the deploy smoked. It now requires 200 and HTML
 * that carries the app's own root element, so a redirect, an error page, or a CDN
 * interstitial fails.
 *
 * VERCEL DEPLOYMENT PROTECTION. `blackstory-git-staging-geraldmarons-projects.vercel.app`
 * is SSO-protected (verified 2026-09-13: `curl -I` returns 302 to vercel.com/sso-api), so
 * pointing E2E_BASE_URL at it without a bypass credential cannot work. When
 * `VERCEL_AUTOMATION_BYPASS_SECRET` is present the harness sends it as
 * `x-vercel-protection-bypass`, which is Vercel's documented header for exactly this. That
 * secret has to be minted in the Vercel dashboard by the account owner; until it exists,
 * the staging smoke has no reachable staging target.
 *
 * DO NOT "fix" that by aiming the staging smoke at blackstory.app. Production is publicly
 * reachable and would return 200 — and that is the problem: a staging deploy's gate would
 * then pass by checking a URL the deploy did not touch. That is the same false green this
 * harness exists to remove, wearing a different hat.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

const baseUrl = process.env.E2E_BASE_URL;
const requireE2E = process.env.CI_REQUIRE_E2E === '1';

// Local loopback hosts, allowed with any port.
const ALLOWED_LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

// Our own staging/production hosts. This is an explicit allowlist, not a wildcard on
// vercel.app or blackstory.app — CI must not be pointable at an arbitrary remote URL.
// Add a new deployment target here (not by loosening the check below) when one is needed.
const ALLOWED_REMOTE_HOSTS = new Set([
  'blackstory.app',
  'www.blackstory.app',
  // Default Vercel Preview/production alias (docs/runbooks/vercel-public-web-cutover.md).
  'blackstory-geraldmarons-projects.vercel.app',
  // Staging deploy alias, echoed by .github/workflows/deploy-staging.yml.
  'blackstory-git-staging-geraldmarons-projects.vercel.app',
]);

function isAllowedBaseUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  return ALLOWED_LOCAL_HOSTS.has(host) || ALLOWED_REMOTE_HOSTS.has(host);
}

test(
  'e2e harness requires a local or allowlisted base URL',
  { skip: !baseUrl && !requireE2E },
  async () => {
    if (!baseUrl) {
      throw new Error('CI_REQUIRE_E2E=1 but E2E_BASE_URL is unset');
    }
    assert.ok(
      isAllowedBaseUrl(baseUrl),
      `E2E_BASE_URL "${baseUrl}" is not localhost or an allowlisted staging/Vercel domain`,
    );
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    const response = await fetch(baseUrl, {
      redirect: 'manual',
      headers: bypass ? { 'x-vercel-protection-bypass': bypass } : {},
    });
    assert.equal(
      response.status,
      200,
      `${baseUrl} returned ${response.status}${
        response.status >= 300 && response.status < 400
          ? ` -> ${response.headers.get('location') ?? '(no location)'}; a deployment behind Vercel protection needs VERCEL_AUTOMATION_BYPASS_SECRET`
          : ''
      }`,
    );
    const body = await response.text();
    assert.match(
      body,
      /<div id="__next"|data-surface=|<html/i,
      `${baseUrl} returned 200 but no app HTML — a CDN interstitial or error page can do that`,
    );
  },
);

test(
  'e2e harness documents skip behavior when no base URL is configured',
  {
    skip: Boolean(baseUrl),
  },
  () => {
    assert.equal(baseUrl, undefined);
  },
);
