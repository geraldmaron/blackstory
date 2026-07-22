/**
 * Drift guard (repo-hi8c / MOB-005 concern 3): api-public's bootstrap/compatibility wire
 * constants must stay aligned with the values domain release-activation fixtures use when
 * minting mobile bootstrap manifests. Domain cannot import `@repo/public-contracts` (ADR-021
 * dependency direction), so this consumer-side test is the compile/test-level shared check.
 *
 * Must match `BOOTSTRAP.compatibility` in
 * `packages/domain/src/publication/release-activation.test.ts` and the sample input in
 * `mobile-bootstrap.test.ts`. If you change one side, change the other in the same PR.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  API_VERSION,
  DEPRECATION_WINDOW_DAYS,
  MIN_SUPPORTED_API_VERSION,
} from '@repo/public-contracts/version';

const DOMAIN_RELEASE_FIXTURE_COMPAT = {
  apiVersion: 'v1',
  minSupportedApiVersion: 'v1',
  deprecationWindowDays: 90,
  minSupportedAppBuild: 1000,
} as const;

test('domain release-activation fixture compat matches @repo/public-contracts wire floor', () => {
  assert.equal(DOMAIN_RELEASE_FIXTURE_COMPAT.apiVersion, API_VERSION);
  assert.equal(DOMAIN_RELEASE_FIXTURE_COMPAT.minSupportedApiVersion, MIN_SUPPORTED_API_VERSION);
  assert.equal(DOMAIN_RELEASE_FIXTURE_COMPAT.deprecationWindowDays, DEPRECATION_WINDOW_DAYS);
  assert.ok(DOMAIN_RELEASE_FIXTURE_COMPAT.minSupportedAppBuild >= 1);
});
