/**
 * End-to-end smoke harness. Full browser flows land with product UI beads.
 * Executable now: validates the gate contract and skips unless E2E_BASE_URL is set.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

const baseUrl = process.env.E2E_BASE_URL;
const requireE2E = process.env.CI_REQUIRE_E2E === '1';

test(
  'e2e harness requires an explicit local base URL',
  { skip: !baseUrl && !requireE2E },
  async () => {
    if (!baseUrl) {
      throw new Error('CI_REQUIRE_E2E=1 but E2E_BASE_URL is unset');
    }
    assert.match(baseUrl, /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i);
    const response = await fetch(baseUrl, { redirect: 'manual' });
    assert.ok(response.status > 0);
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
