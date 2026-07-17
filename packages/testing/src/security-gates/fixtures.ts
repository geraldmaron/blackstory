/**
 * Harmless, deterministic attack fixtures for local API and policy contract tests.
 * No fixture sends network traffic or targets a live service.
 */

export const SSRF_URL_FIXTURES = [
  'http://127.0.0.1/admin',
  'http://169.254.169.254/computeMetadata/v1/',
  'http://10.0.0.1/internal',
  'http://[::1]/',
  'http://metadata.google.internal/computeMetadata/v1/',
] as const;

export const XSS_TEXT_FIXTURES = [
  '<script>alert(1)</script>',
  '"><img src=x onerror=alert(1)>',
  "Robert');</textarea><svg onload=alert(1)>",
] as const;

export const CSRF_TOKEN_FIXTURE = '0123456789abcdef0123456789abcdef';

export const MASS_ASSIGNMENT_FIXTURE = {
  title: 'Correction',
  statement: 'A bounded correction statement.',
  ownerSubject: 'attacker',
  moderationState: 'approved',
  publicationState: 'active',
  roles: ['admin'],
} as const;

export const RESOURCE_CONSUMPTION_FIXTURES = {
  regexQuery: '/^(a+)+$/',
  oversizedQuery: 'x'.repeat(1_000),
  oversizedStatement: 'x'.repeat(20_000),
  exhaustedDailySourceFetches: 2_000,
} as const;

export const TEST_COMMIT_SHA = 'a'.repeat(40);
export const TEST_IMAGE_DIGEST = `sha256:${'b'.repeat(64)}`;
