/**
 * Wayback HTTP client host allowlist tests. No live network: rejected URLs fail
 * at evaluateExternalUrl before DNS, so nothing here resolves or connects.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WAYBACK_AVAILABILITY_URL, WAYBACK_SPN_SUBMIT_URL } from '@repo/domain';
import { evaluateExternalUrl } from '@repo/security/url-safety';
import { waybackSafeHttpClient, WAYBACK_HOSTS } from './wayback-http.js';

test('waybackSafeHttpClient rejects hosts outside archive.org before DNS', async () => {
  await assert.rejects(
    () => waybackSafeHttpClient({ url: 'https://example.com/save', method: 'POST' }),
    /domain_not_allowed/,
  );
  // A lookalike that merely contains the allowed name must not pass the suffix match.
  await assert.rejects(
    () => waybackSafeHttpClient({ url: 'https://archive.org.evil.example/save', method: 'GET' }),
    /domain_not_allowed/,
  );
  await assert.rejects(
    () => waybackSafeHttpClient({ url: 'http://127.0.0.1/save', method: 'GET' }),
    /rejected by safe-fetch policy/,
  );
});

test('the allowlist admits the availability host, not just the SPN host', () => {
  // The availability API lives on the apex (archive.org/wayback/available); SPN2 lives on
  // web.archive.org. Both have to clear the policy or the lookup fallback never leaves the
  // process. Run against the client's own exported allowlist, at the policy layer, so this
  // asserts the real configuration without any DNS or socket.
  const policy = { allowedDomains: WAYBACK_HOSTS };
  assert.equal(evaluateExternalUrl(WAYBACK_AVAILABILITY_URL, policy).allowed, true);
  assert.equal(evaluateExternalUrl(WAYBACK_SPN_SUBMIT_URL, policy).allowed, true);
  assert.equal(evaluateExternalUrl('https://example.com/save', policy).allowed, false);
});
