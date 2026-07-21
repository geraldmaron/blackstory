/**
 * MOB-004 evidence gate — validates the OpenAPI artifact route table matches the live router and
 * that redacted response example JSON files parse against `@repo/public-contracts` zod schemas.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { bootstrapResponseV1Schema } from '@repo/public-contracts/v1/bootstrap';
import { entityV1Schema } from '@repo/public-contracts/v1/entity';
import { searchResponseV1Schema } from '@repo/public-contracts/v1/search';
import { publicApiErrorEnvelopeSchema } from '@repo/public-contracts/errors';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_PUBLIC_ROOT = join(__dirname, '../..');
const OPENAPI_PATH = join(API_PUBLIC_ROOT, 'openapi/public-v1.openapi.yaml');
const EXAMPLES_DIR = join(API_PUBLIC_ROOT, 'fixtures/redacted-response-examples');

const ROUTER_PATHS = [
  '/v1/health',
  '/v1/compatibility',
  '/v1/bootstrap',
  '/v1/search',
  '/v1/entity/{id}',
] as const;

const FORBIDDEN_ENTITY_KEYS = [
  'notabilityScore',
  'relevanceRankingScore',
  'preciseLocation',
  'residentialAddress',
  'internalReviewNotes',
  'sourceLineageInternal',
  'moderationState',
  'draftOnly',
  'unpublishedStatus',
  '__collection',
  'gsUri',
] as const;

const FORBIDDEN_SEARCH_RESULT_KEYS = [
  ...FORBIDDEN_ENTITY_KEYS,
  'score',
  'relevance',
  'evidenceCount',
  'connectionCount',
] as const;

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(join(EXAMPLES_DIR, relativePath), 'utf8'));
}

function assertNoForbiddenKeys(value: unknown, forbidden: readonly string[], label: string): void {
  if (typeof value !== 'object' || value === null) return;
  for (const key of forbidden) {
    assert.ok(!(key in value), `${label} must not contain ${key}`);
  }
}

test('OpenAPI artifact lists every `/v1` route the router serves', () => {
  const openapi = readFileSync(OPENAPI_PATH, 'utf8');
  for (const route of ROUTER_PATHS) {
    assert.match(openapi, new RegExp(`\\n  ${route.replace('{', '\\{').replace('}', '\\}')}:`));
  }
});

test('redacted bootstrap example matches bootstrapResponseV1Schema', () => {
  const parsed = bootstrapResponseV1Schema.safeParse(readJson('bootstrap-200.json'));
  assert.equal(parsed.success, true, parsed.success ? '' : JSON.stringify(parsed.error.issues));
});

test('redacted entity example matches entityV1Schema and carries no forbidden keys', () => {
  const body = readJson('entity-200.json');
  const parsed = entityV1Schema.safeParse(body);
  assert.equal(parsed.success, true, parsed.success ? '' : JSON.stringify(parsed.error.issues));
  assertNoForbiddenKeys(body, FORBIDDEN_ENTITY_KEYS, 'entity example');
  const precision = (body as { locationPrecision: string }).locationPrecision;
  assert.ok(['city', 'neighborhood', 'campus', 'institution'].includes(precision));
});

test('redacted search example matches searchResponseV1Schema and omits ranking scores', () => {
  const body = readJson('search-200.json');
  const parsed = searchResponseV1Schema.safeParse(body);
  assert.equal(parsed.success, true, parsed.success ? '' : JSON.stringify(parsed.error.issues));
  const result = (body as { results: Record<string, unknown>[] }).results[0];
  assertNoForbiddenKeys(result, FORBIDDEN_SEARCH_RESULT_KEYS, 'search result example');
});

test('error envelope examples match publicApiErrorEnvelopeSchema', () => {
  for (const file of [
    'error-not-found-404.json',
    'error-rate-limited-429.json',
    'error-client-version-426.json',
  ]) {
    const parsed = publicApiErrorEnvelopeSchema.safeParse(readJson(file));
    assert.equal(parsed.success, true, `${file}: ${parsed.success ? '' : JSON.stringify(parsed.error.issues)}`);
  }
});

test('compatibility example carries only public version-floor fields', () => {
  const body = readJson('compatibility-200.json') as Record<string, unknown>;
  assert.deepEqual(Object.keys(body).sort(), [
    'currentApiVersion',
    'deprecationWindowDays',
    'minSupportedApiVersion',
    'softDeprecated',
    'supported',
  ]);
});

test('health example exposes surface posture without secrets', () => {
  const body = readJson('health-200.json') as Record<string, unknown>;
  assert.equal(body.surface, 'api-public');
  assert.equal(body.status, 'ok');
  assert.ok(Array.isArray(body.allowedOperations));
  for (const key of Object.keys(body)) {
    assert.ok(!/secret|token|password|database/i.test(key), `health example must not expose ${key}`);
  }
});
