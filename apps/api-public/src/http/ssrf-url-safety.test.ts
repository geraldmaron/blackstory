/**
 * SSRF regression tests for citation/media URLs on the public read surface (repo-rw1p).
 *
 * Proves api-public never server-fetches user-controlled or entity-embedded URLs — URLs are
 * pass-through of already-redacted release projections, bounded by `@repo/public-contracts` zod
 * validation at the data-access port boundary. Malicious schemes must not reach the wire.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ClientAttestationHeaders } from '@repo/security';
import type { EntityV1 } from '@repo/public-contracts/v1/entity';
import { publicApiErrorEnvelopeSchema } from '@repo/public-contracts/errors';
import { createPublicRateLimitGuard } from '../rate-limits.js';
import { createPublicSearchGuard } from '../search-guardrails.js';
import {
  createInMemoryPublicDataAccess,
  type PublicDataAccess,
} from './data-access.js';
import { dispatch } from './router.js';
import type { ApiRequest, HandlerDeps } from './handlers.js';
import { makeEntity, SAMPLE_POINTER } from './entity-fixture.js';

const FIXED_NOW = 1_800_000_000_000;

const VALID_CLAIM = {
  id: 'claim_ssrf_001',
  predicate: 'documented_at',
  object: 'Archive record',
  confidenceScore: 0.85,
  confidenceLevel: 'high' as const,
  citation: {
    source: 'D.C. Board of Education annual report, 1916',
    label: '1916 annual report',
    href: 'https://example.gov/dc-board-1916',
  },
};

const VALID_MEDIA = {
  url: 'https://storage.googleapis.com/black-book-media/entities/ent_dunbar_school_001/primary.jpg',
  alt: 'School building',
  credit: 'Library of Congress',
  rightsStatus: 'public_domain' as const,
};

/** Malicious URL shapes that must never survive `entityV1Schema` validation. */
const REJECTED_URLS = [
  'javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'file:///etc/passwd',
  'gopher://127.0.0.1:70/1',
  'not a url',
] as const;

function makeDeps(dataAccess: PublicDataAccess): HandlerDeps {
  return {
    dataAccess,
    clientAttestationGuard: async ({ headers }: { headers: ClientAttestationHeaders }) => ({
      allowed: true,
      verified: Boolean((headers as Record<string, string | undefined>)['x-blackstory-client']),
      mode: 'monitor',
    }),
    rateLimitGuard: createPublicRateLimitGuard({ now: () => FIXED_NOW }),
    searchGuard: createPublicSearchGuard(),
  };
}

function makeRequest(path: string): ApiRequest {
  return {
    method: 'GET',
    path,
    query: new URLSearchParams(''),
    headers: {},
    requestId: 'req_ssrf',
  };
}

type FetchCall = { readonly input: string; readonly init?: RequestInit };

/** Installs a global `fetch` spy that records every call and fails the test if invoked. */
function withFetchBlocked<T>(run: (recorded: FetchCall[]) => Promise<T>): Promise<T> {
  const recorded: FetchCall[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    recorded.push({ input: String(input), init });
    throw new Error('api-public must not fetch citation/media URLs server-side');
  }) as typeof fetch;
  return run(recorded).finally(() => {
    globalThis.fetch = original;
  });
}

test('SSRF: in-memory adapter rejects non-http(s) primaryImage.url at construction', () => {
  for (const url of REJECTED_URLS) {
    assert.throws(
      () =>
        createInMemoryPublicDataAccess({
          pointer: SAMPLE_POINTER,
          entities: [makeEntity({ primaryImage: { ...VALID_MEDIA, url } })],
        }),
      `primaryImage.url must reject ${url}`,
    );
  }
});

test('SSRF: in-memory adapter rejects non-http(s) citation.href at construction', () => {
  for (const url of REJECTED_URLS) {
    assert.throws(
      () =>
        createInMemoryPublicDataAccess({
          pointer: SAMPLE_POINTER,
          entities: [
            makeEntity({
              claims: [{ ...VALID_CLAIM, citation: { ...VALID_CLAIM.citation, href: url } }],
            }),
          ],
        }),
      `citation.href must reject ${url}`,
    );
  }
});

test('SSRF: handler never calls global fetch for entity with metadata-service-shaped https URLs', async () => {
  const entity = makeEntity({
    primaryImage: {
      ...VALID_MEDIA,
      url: 'http://169.254.169.254/latest/meta-data/',
    },
    claims: [
      {
        ...VALID_CLAIM,
        citation: {
          ...VALID_CLAIM.citation,
          href: 'http://127.0.0.1:8080/admin',
        },
      },
    ],
  });
  const deps = makeDeps(
    createInMemoryPublicDataAccess({ pointer: SAMPLE_POINTER, entities: [entity] }),
  );

  await withFetchBlocked(async (fetchCalls) => {
    const res = await dispatch(makeRequest('/v1/entity/ent_dunbar_school_001'), deps);
    assert.equal(res.status, 200);
    assert.equal(fetchCalls.length, 0, 'api-public must not server-fetch embedded URLs');
    const body = res.body as EntityV1;
    assert.equal(body.primaryImage?.url, 'http://169.254.169.254/latest/meta-data/');
    assert.equal(body.claims[0]?.citation.href, 'http://127.0.0.1:8080/admin');
  });
});

test('SSRF: handler never calls global fetch on search over URL-bearing entities', async () => {
  const entity = makeEntity({
    primaryImage: VALID_MEDIA,
    claims: [VALID_CLAIM],
  });
  const deps = makeDeps(
    createInMemoryPublicDataAccess({ pointer: SAMPLE_POINTER, entities: [entity] }),
  );

  await withFetchBlocked(async (fetchCalls) => {
    const res = await dispatch(
      {
        ...makeRequest('/v1/search'),
        query: new URLSearchParams('q=dunbar'),
        headers: { 'x-blackstory-client': 'mobile/1.0.0; api=1' },
      },
      deps,
    );
    assert.equal(res.status, 200);
    assert.equal(fetchCalls.length, 0, 'search must not server-fetch result citation/media URLs');
  });
});

test('SSRF: bypassing port validation yields INTERNAL — malicious href never reaches the wire', async () => {
  const bypassingAccess: PublicDataAccess = {
    async getReleasePointer() {
      return SAMPLE_POINTER;
    },
    async getEntity() {
      return {
        ...makeEntity(),
        claims: [
          {
            ...VALID_CLAIM,
            citation: { ...VALID_CLAIM.citation, href: 'javascript:alert(1)' },
          },
        ],
      } as unknown as EntityV1;
    },
    async listEntities() {
      return [];
    },
    async search() {
      return { results: [], facets: {}, totalMatched: 0, hasMore: false };
    },
  };

  await withFetchBlocked(async (fetchCalls) => {
    const res = await dispatch(makeRequest('/v1/entity/ent_dunbar_school_001'), makeDeps(bypassingAccess));
    assert.equal(res.status, 500);
    assert.equal(publicApiErrorEnvelopeSchema.parse(res.body).error.code, 'INTERNAL');
    assert.equal(fetchCalls.length, 0);
  });
});

test('SSRF: bootstrap/entity/search handlers do not invoke fetch even when global fetch exists', async () => {
  const deps = makeDeps(
    createInMemoryPublicDataAccess({
      pointer: SAMPLE_POINTER,
      entities: [makeEntity({ primaryImage: VALID_MEDIA, claims: [VALID_CLAIM] })],
    }),
  );

  await withFetchBlocked(async (fetchCalls) => {
    await dispatch(makeRequest('/v1/bootstrap'), deps);
    await dispatch(makeRequest('/v1/entity/ent_dunbar_school_001'), deps);
    await dispatch(
      {
        ...makeRequest('/v1/search'),
        query: new URLSearchParams('q=dunbar'),
        headers: { 'x-blackstory-client': 'mobile/1.0.0; api=1' },
      },
      deps,
    );
    assert.equal(fetchCalls.length, 0);
  });
});
