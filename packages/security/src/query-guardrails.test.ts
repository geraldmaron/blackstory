/**
 * Search and query resource guardrail tests (BB-026).
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import {
  buildSearchCacheKey,
  canonicalizeForCacheKey,
  createSlowQueryLogEvent,
  decodeSearchCursor,
  DEFAULT_QUERY_GUARDRAIL_LIMITS,
  encodeSearchCursor,
  estimateQueryCost,
  evaluateSearchQueryGuardrails,
  getQueryTimeoutPolicy,
  hashCanonicalQuery,
  isWildcardOnlyQuery,
  looksLikeRegexInput,
  normalizeSearchText,
  searchQueryEndpointMetadata,
  type CanonicalSearchQuery,
  type SearchQueryInput,
} from './query-guardrails.ts';

const BASE_CANONICAL: CanonicalSearchQuery = {
  q: 'harriet tubman',
  filters: [{ field: 'kind', value: 'person' }],
  sort: 'relevance',
  pageSize: 20,
  depth: 1,
  shape: 'text_filters',
};

test('normalizeSearchText applies NFKC, trim, and whitespace collapse', () => {
  assert.equal(normalizeSearchText('  Harriet\u200b  Tubman  '), 'Harriet Tubman');
  assert.equal(normalizeSearchText('ＡＢＣ'), 'ABC');
});

test('canonicalizeForCacheKey lowercases normalized text', () => {
  assert.equal(canonicalizeForCacheKey('  Harriet  Tubman '), 'harriet tubman');
});

test('rejects prohibited SQL, field selection, and regex inputs', () => {
  assert.equal(
    evaluateSearchQueryGuardrails({ q: 'test', sql: 'SELECT * FROM entities' }).allowed,
    false,
  );
  assert.equal(
    evaluateSearchQueryGuardrails({ q: 'test', fields: ['secretField'] }).allowed,
    false,
  );
  assert.equal(
    evaluateSearchQueryGuardrails({ q: 'test', orderBy: 'name DESC; DROP TABLE' }).allowed,
    false,
  );
  assert.equal(evaluateSearchQueryGuardrails({ q: '/foo.*/i' }).allowed, false);
  assert.equal(evaluateSearchQueryGuardrails({ q: 'test', regex: '.*' }).allowed, false);
});

test('rejects wildcard-only queries', () => {
  assert.equal(isWildcardOnlyQuery('***'), true);
  assert.equal(isWildcardOnlyQuery('%?_'), true);
  assert.equal(isWildcardOnlyQuery('tubman'), false);
  assert.equal(evaluateSearchQueryGuardrails({ q: '***' }).allowed, false);
});

test('looksLikeRegexInput detects slash-delimited patterns', () => {
  assert.equal(looksLikeRegexInput('/pattern/gi'), true);
  assert.equal(looksLikeRegexInput('plain text'), false);
});

test('enforces min/max query length', () => {
  assert.equal(evaluateSearchQueryGuardrails({ q: 'a' }).allowed, false);
  const longQ = 'x'.repeat(DEFAULT_QUERY_GUARDRAIL_LIMITS.maxQueryLength + 1);
  assert.equal(evaluateSearchQueryGuardrails({ q: longQ }).allowed, false);
  assert.equal(evaluateSearchQueryGuardrails({ q: 'ab' }).allowed, true);
});

test('allowlists sort keys and filter fields only', () => {
  assert.equal(evaluateSearchQueryGuardrails({ q: 'test', sort: 'name_asc' }).allowed, true);
  assert.equal(evaluateSearchQueryGuardrails({ q: 'test', sort: 'DROP TABLE' }).allowed, false);
  assert.equal(
    evaluateSearchQueryGuardrails({
      q: 'test',
      filters: { kind: 'person', secretColumn: 'x' },
    }).allowed,
    false,
  );
});

test('bounds geo radius and requires complete geo tuple', () => {
  assert.equal(
    evaluateSearchQueryGuardrails({ q: 'test', lat: 40.7, lng: -74.0 }).allowed,
    false,
  );
  assert.equal(
    evaluateSearchQueryGuardrails({
      q: 'test',
      lat: 40.7,
      lng: -74.0,
      radiusM: DEFAULT_QUERY_GUARDRAIL_LIMITS.maxRadiusM + 1,
    }).allowed,
    false,
  );
  assert.equal(
    evaluateSearchQueryGuardrails({
      q: 'test',
      lat: 40.7,
      lng: -74.0,
      radiusM: 5_000,
    }).allowed,
    true,
  );
});

test('bounds page size and pagination depth via cursor', () => {
  assert.equal(
    evaluateSearchQueryGuardrails({ q: 'test', pageSize: 999 }).allowed,
    false,
  );

  const first = evaluateSearchQueryGuardrails({ q: 'test', pageSize: 10 });
  assert.equal(first.allowed, true);
  if (!first.allowed) {
    return;
  }

  const cursor = encodeSearchCursor({
    v: 1,
    depth: DEFAULT_QUERY_GUARDRAIL_LIMITS.maxPaginationDepth,
    queryHash: first.queryHash,
    position: 'doc-99',
  });

  const tooDeep = evaluateSearchQueryGuardrails({ q: 'test', pageSize: 10, cursor });
  assert.equal(tooDeep.allowed, false);
  if (!tooDeep.allowed) {
    assert.equal(tooDeep.reason, 'pagination_depth_exceeded');
  }
});

test('cursor decode validates hash binding and shape', () => {
  const hash = hashCanonicalQuery(BASE_CANONICAL);
  const cursor = encodeSearchCursor({ v: 1, depth: 1, queryHash: hash, position: 'doc-1' });
  const ok = decodeSearchCursor(cursor, hash);
  assert.ok('v' in ok);

  const badHash = decodeSearchCursor(cursor, '0'.repeat(64));
  assert.ok('reason' in badHash);
  if ('reason' in badHash) {
    assert.equal(badHash.reason, 'cursor_invalid');
  }
});

test('cache key is stable for equivalent normalized input', () => {
  const left = evaluateSearchQueryGuardrails({ q: '  Harriet  Tubman ', filters: { kind: 'person' } });
  const right = evaluateSearchQueryGuardrails({ q: 'harriet tubman', filters: { kind: 'person' } });
  assert.equal(left.allowed, true);
  assert.equal(right.allowed, true);
  if (left.allowed && right.allowed) {
    assert.equal(left.cacheKey, right.cacheKey);
    assert.equal(buildSearchCacheKey(left.canonical), buildSearchCacheKey(right.canonical));
  }
});

test('timeout policy fails closed', () => {
  const policy = getQueryTimeoutPolicy();
  assert.equal(policy.failClosed, true);
  assert.ok(policy.queryTimeoutMs >= policy.firestoreStatementTimeoutMs);
});

test('slow query log event shape includes failClosed', () => {
  const event = createSlowQueryLogEvent({
    queryHash: 'abc',
    shape: 'text',
    durationMs: 6_000,
    resultCount: 0,
    timedOut: true,
    estimatedCost: 100,
  });
  assert.equal(event.event, 'slow_query');
  assert.equal(event.failClosed, true);
  assert.equal(event.endpointClass, 'search');
});

test('searchQueryEndpointMetadata integrates with BB-025 endpoint classes', () => {
  const decision = evaluateSearchQueryGuardrails({ q: 'test' });
  assert.equal(decision.allowed, true);
  if (decision.allowed) {
    const meta = searchQueryEndpointMetadata(decision);
    assert.equal(meta.endpointClass, 'search');
    assert.equal(meta.costTier, 'expensive_read');
    assert.ok(meta.queryHash.length === 64);
  }
});

test('export limit denial', () => {
  const denied = evaluateSearchQueryGuardrails(
    { q: 'test' },
    { forExport: true, exportCount: DEFAULT_QUERY_GUARDRAIL_LIMITS.maxExportResults + 1 },
  );
  assert.equal(denied.allowed, false);
  if (!denied.allowed) {
    assert.equal(denied.reason, 'export_limit_exceeded');
  }
});

function seededVariants(seed: number, count: number): SearchQueryInput[] {
  const variants: SearchQueryInput[] = [];
  let state = seed;
  const next = () => {
    state = (state * 1_103_515_245 + 12_345) & 0x7fffffff;
    return state;
  };

  for (let i = 0; i < count; i += 1) {
    const roll = next() % 12;
    const qLen = (next() % DEFAULT_QUERY_GUARDRAIL_LIMITS.maxQueryLength) + 1;
    const q = 'q'.repeat(qLen);
    switch (roll) {
      case 0:
        variants.push({ q });
        break;
      case 1:
        variants.push({ q: '***' });
        break;
      case 2:
        variants.push({ q, filters: { kind: 'person', state: 'NY', precision: 'city', releaseId: 'rel-1', extra: 'x' } as Record<string, string> });
        break;
      case 3:
        variants.push({ q, lat: 40 + (next() % 10), lng: -75, radiusM: next() % 100_000 });
        break;
      case 4:
        variants.push({ q, pageSize: next() % 200 });
        break;
      case 5:
        variants.push({ q, sort: ['name_asc', 'evil_sort', 'distance'][next() % 3] });
        break;
      case 6:
        variants.push({ q, sql: 'select 1' });
        break;
      case 7:
        variants.push({ q: '/x.*/', regex: 'bad' });
        break;
      case 8:
        variants.push({ filters: { kind: 'place' } });
        break;
      case 9: {
        const depth = (next() % 30) + 1;
        const hash = createHash('sha256').update(String(i)).digest('hex');
        variants.push({
          q: 'fuzz',
          cursor: encodeSearchCursor({ v: 1, depth, queryHash: hash, position: 'p' }),
        });
        break;
      }
      case 10:
        variants.push({
          q: 'history',
          dateFrom: '1800-01-01T00:00:00.000Z',
          dateTo: '2026-01-01T00:00:00.000Z',
        });
        break;
      default:
        variants.push({ q: '  FUZZ\u200b  CASE  ', filters: { kind: 'Person' } });
        break;
    }
  }
  return variants;
}

test('deterministic fuzz variants stay within cost budget or deny', () => {
  const variants = seededVariants(26, 240);
  let allowedCount = 0;

  for (const input of variants) {
    const decision = evaluateSearchQueryGuardrails(input);
    if (decision.allowed) {
      allowedCount += 1;
      assert.ok(decision.estimatedCost <= DEFAULT_QUERY_GUARDRAIL_LIMITS.maxEstimatedCost);
      assert.ok(decision.timeoutMs > 0);
      assert.ok(decision.exportLimit <= DEFAULT_QUERY_GUARDRAIL_LIMITS.maxExportResults);
    } else {
      assert.ok(decision.reason.length > 0);
    }
  }

  assert.ok(allowedCount > 0);
  assert.ok(allowedCount < variants.length);
});

test('estimateQueryCost increases with depth and filters', () => {
  const shallow = estimateQueryCost({ ...BASE_CANONICAL, depth: 1 });
  const deep = estimateQueryCost({ ...BASE_CANONICAL, depth: 10 });
  assert.ok(deep > shallow);
});
