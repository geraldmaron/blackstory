/**
 * Real `node:http` server tests — drive the actual socket adapter end-to-end (container
 * startup/health, ETag revalidation over the wire, and the untrusted-input caps: URL length, body
 * size, JSON depth). Uses an ephemeral port + global `fetch`.
 */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import type { ClientAttestationHeaders } from '@repo/security';
import { createPublicRateLimitGuard } from '../rate-limits.js';
import { createPublicSearchGuard } from '../search-guardrails.js';
import { createInMemoryPublicDataAccess } from './data-access.js';
import type { HandlerDeps } from './handlers.js';
import { createPublicApiServer, parseJsonWithDepthLimit } from './server.js';
import { makeEntity, SAMPLE_POINTER } from './entity-fixture.js';

function makeDeps(): HandlerDeps {
  return {
    dataAccess: createInMemoryPublicDataAccess({ pointer: SAMPLE_POINTER, entities: [makeEntity()] }),
    clientAttestationGuard: async ({ headers }: { headers: ClientAttestationHeaders }) => ({
      allowed: true,
      verified: Boolean((headers as Record<string, string | undefined>)['x-blackstory-client']),
      mode: 'monitor',
    }),
    rateLimitGuard: createPublicRateLimitGuard({ now: () => 1_800_000_000_000 }),
    searchGuard: createPublicSearchGuard(),
  };
}

async function withServer(
  run: (base: string) => Promise<void>,
  limits?: { maxUrlLength?: number; maxBodyBytes?: number },
): Promise<void> {
  const server = createPublicApiServer(makeDeps(), { ...(limits ? { limits } : {}) });
  server.listen(0);
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('server serves /v1/health (container startup/health check)', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/v1/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { status: string; service: string };
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'api-public');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.ok(res.headers.get('x-request-id'));
  });
});

test('server ETag + If-None-Match yields 304 over the wire', async () => {
  await withServer(async (base) => {
    const first = await fetch(`${base}/v1/entity/ent_dunbar_school_001`);
    assert.equal(first.status, 200);
    const etag = first.headers.get('etag');
    assert.ok(etag);
    const second = await fetch(`${base}/v1/entity/ent_dunbar_school_001`, {
      headers: { 'If-None-Match': etag as string },
    });
    assert.equal(second.status, 304);
    assert.equal(await second.text(), '');
  });
});

test('ADVERSARIAL: oversized query string is rejected 414 before dispatch', async () => {
  await withServer(
    async (base) => {
      const bomb = 'x'.repeat(500);
      const res = await fetch(`${base}/v1/search?q=${bomb}`);
      assert.equal(res.status, 414);
    },
    { maxUrlLength: 100 },
  );
});

test('ADVERSARIAL: oversized request body is rejected 413', async () => {
  await withServer(
    async (base) => {
      const res = await fetch(`${base}/v1/search`, {
        method: 'POST',
        body: 'y'.repeat(5000),
      });
      assert.equal(res.status, 413);
    },
    { maxBodyBytes: 1024 },
  );
});

test('HEAD /v1/health returns headers with no body', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/v1/health`, { method: 'HEAD' });
    assert.equal(res.status, 200);
    assert.equal(await res.text(), '');
  });
});

test('ADVERSARIAL: parseJsonWithDepthLimit rejects a JSON depth bomb', () => {
  const deep = '['.repeat(50) + ']'.repeat(50);
  assert.throws(() => parseJsonWithDepthLimit(deep, 16), RangeError);
  // A shallow document still parses correctly, and brackets inside strings are ignored.
  assert.deepEqual(parseJsonWithDepthLimit('{"a":"[[[[[not-depth]]]]]","b":[1,2]}', 16), {
    a: '[[[[[not-depth]]]]]',
    b: [1, 2],
  });
});
