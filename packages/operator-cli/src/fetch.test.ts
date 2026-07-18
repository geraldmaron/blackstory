
/**
 * Verifies the real DNS-resolve + pinned-transport dependencies (against a local loopback
 * server no external network required) and the pure citation-prefill capture-plan helpers.
 *
 * The pinned transport is tested directly, not through `executeSafeFetch`, because
 * `executeSafeFetch`'s own policy layer correctly refuses loopback/private addresses (
 * SSRF protection) that policy is exercised by `packages/security`'s own tests. This file
 * only proves our transport implementation speaks the `PinnedTransport` contract correctly.
 */
import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { test } from 'node:test';
import type { SafeFetchResult } from '@blap/security';
import {
  buildCitationPrefill,
  nodePinnedTransport,
  nodeResolveHost,
  planSelectiveCapture,
} from './fetch.ts';

async function withLocalServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
  run: (port: number) => Promise<void>,
): Promise<void> {
  const server: Server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('expected a bound TCP address');
  try {
    await run(address.port);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('nodeResolveHost resolves localhost via the real system resolver', async () => {
  const answers = await nodeResolveHost('localhost');
  assert.ok(answers.length > 0);
  for (const answer of answers) {
    assert.ok(answer.family === 4 || answer.family === 6);
    assert.ok(answer.address.length > 0);
  }
});

test('nodePinnedTransport connects to the pinned address and streams the response body', async () => {
  await withLocalServer(
    (_req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('hello from the pinned transport');
    },
    async (port) => {
      const controller = new AbortController();
      const response = await nodePinnedTransport({
        url: `http://127.0.0.1:${port}/`,
        hostname: '127.0.0.1',
        port,
        pinnedAddress: '127.0.0.1',
        headers: { host: '127.0.0.1', accept: 'text/plain' },
        signal: controller.signal,
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers['content-type'], 'text/plain');
      assert.equal(response.remoteAddress, '127.0.0.1');

      const chunks: Buffer[] = [];
      for await (const chunk of response.body) chunks.push(Buffer.from(chunk));
      assert.equal(Buffer.concat(chunks).toString('utf8'), 'hello from the pinned transport');
    },
  );
});

function safeFetchOk(overrides: Partial<Extract<SafeFetchResult, { ok: true }>> = {}) {
  return {
    ok: true as const,
    finalUrl: 'https://archive.example.org/item/1',
    redirectCount: 0,
    contentType: 'text/html',
    byteLength: 512,
    contentHash: 'a'.repeat(64),
    parser: {
      safe: true,
      indicators: [],
      extractedText: 'The Douglass Avenue office opened in 1962. It served as a mutual-aid hub.',
    },
    quarantineState: 'validated' as const,
    publicationAllowed: false as const,
    ...overrides,
  };
}

test('buildCitationPrefill derives a suggested title and excerpt without any network access', () => {
  const prefill = buildCitationPrefill(
    'https://archive.example.org/item/1',
    safeFetchOk(),
    '2026-07-17T04:00:00.000Z',
  );
  assert.equal(prefill.sourceUrl, 'https://archive.example.org/item/1');
  assert.equal(prefill.contentHash, 'a'.repeat(64));
  assert.equal(prefill.suggestedTitle, 'The Douglass Avenue office opened in 1962.');
  assert.ok(prefill.excerpt.includes('mutual-aid hub'));
});

test('planSelectiveCapture documents the Wayback integration point without calling it', () => {
  const plan = planSelectiveCapture(safeFetchOk());
  assert.equal(plan.waybackIntegration, 'not_wired');
  assert.equal(plan.snapshotMode, 'selective');
  assert.equal(plan.contentHash, 'a'.repeat(64));
  assert.ok(/no wayback/iu.test(plan.notes));
});
