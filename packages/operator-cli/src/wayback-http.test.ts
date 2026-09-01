/**
 * Wayback HTTP client host allowlist tests. No live network: rejected URLs fail
 * at evaluateExternalUrl before DNS.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { waybackSafeHttpClient } from './wayback-http.js';

test('waybackSafeHttpClient rejects hosts other than web.archive.org before DNS', async () => {
  await assert.rejects(
    () => waybackSafeHttpClient({ url: 'https://example.com/save', method: 'POST' }),
    /domain_not_allowed/,
  );
  await assert.rejects(
    () => waybackSafeHttpClient({ url: 'https://archive.org/save', method: 'GET' }),
    /domain_not_allowed/,
  );
  await assert.rejects(
    () => waybackSafeHttpClient({ url: 'http://127.0.0.1/save', method: 'GET' }),
    /rejected by safe-fetch policy/,
  );
});
