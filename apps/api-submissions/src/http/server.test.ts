/**
 * Real `node:http` server tests for api-submissions corrections intake.
 */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import type { AppCheckVerifier } from '@repo/firebase';
import { createSubmissionsApiAppCheckGuard } from '../app-check.ts';
import { createSubmissionsRateLimitGuard } from '../rate-limits.ts';
import {
  createInMemorySubmissionQuarantineRepository,
  createSubmissionQuarantineService,
} from '../quarantine.ts';
import { createCorrectionReceiptStore } from '../corrections/store.ts';
import { createIdempotencyCache } from '../corrections/idempotency-cache.ts';
import type { HandlerDeps } from './handlers.ts';
import { createSubmissionsApiServer, parseJsonWithDepthLimit } from './server.ts';

const PEPPER = 'server-test-pepper';

function makeDeps(): HandlerDeps {
  const repository = createInMemorySubmissionQuarantineRepository();
  const verifier: AppCheckVerifier = {
    async verifyToken() {
      return { appId: 'test-app' };
    },
  };
  return {
    quarantineService: createSubmissionQuarantineService({
      repository,
      privacyPepper: PEPPER,
      now: () => 0,
    }),
    appCheckGuard: createSubmissionsApiAppCheckGuard({
      environment: { APP_CHECK_MODE: 'enforce' },
      verifier,
      telemetry: { record: () => {} },
    }),
    rateLimitGuard: createSubmissionsRateLimitGuard({ now: () => 0 }),
    store: createCorrectionReceiptStore(),
    idempotencyCache: createIdempotencyCache(),
    privacyPepper: PEPPER,
    now: () => 0,
  };
}

async function withServer(
  run: (base: string) => Promise<void>,
  limits?: { maxUrlLength?: number; maxBodyBytes?: number; maxJsonDepth?: number },
): Promise<void> {
  const server = createSubmissionsApiServer(makeDeps(), { ...(limits ? { limits } : {}) });
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

test('server serves /v1/health', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/v1/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { surface: string };
    assert.equal(body.surface, 'api-submissions');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.ok(res.headers.get('x-request-id'));
  });
});

test('server accepts POST /v1/corrections over the wire', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/v1/corrections`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-firebase-appcheck': 'token',
      },
      body: JSON.stringify({
        targetType: 'entity',
        targetRecordId: 'entity-rosewood',
        category: 'factual_error',
        statement: 'The published opening year should be 1924 according to the county superintendent ledger.',
        sourceUrl: 'https://example.org/ledger',
        privacyConsent: true,
      }),
    });
    assert.equal(res.status, 202);
    const body = (await res.json()) as { receiptCode: string; statusHref: string };
    assert.match(body.receiptCode, /^BB-COR-/);
    assert.equal(body.statusHref, '/v1/corrections/status');
  });
});

test('ADVERSARIAL: JSON body exceeding depth limit is rejected before dispatch', () => {
  const bomb = `{"a":${'{"a":'.repeat(20)}{}${'}'.repeat(20)}}`;
  assert.throws(() => parseJsonWithDepthLimit(bomb, 8), RangeError);
});

test('ADVERSARIAL: oversized body is rejected 413 before dispatch', async () => {
  await withServer(
    async (base) => {
      const res = await fetch(`${base}/v1/corrections`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': String(128 * 1024),
        },
        body: 'x'.repeat(128 * 1024),
      });
      assert.equal(res.status, 413);
    },
    { maxBodyBytes: 64 * 1024 },
  );
});
