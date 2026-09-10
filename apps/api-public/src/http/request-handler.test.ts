/**
 * The serverless host never constructs a `node:http` server: it hands the function an
 * `(req, res)` pair it made itself. These tests drive `createPublicApiRequestHandler` that way,
 * with no listener and no socket, because that is the only path the Vercel function takes and
 * `server.test.ts` cannot cover it — it goes over a real port.
 *
 * The pairing assertion at the end is the one that matters: if the server ever stops being a
 * thin wrapper around this handler, the two hosts have started to drift and one of them is
 * serving something nobody tested.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import type { ClientAttestationHeaders } from '@repo/security';
import { createPublicRateLimitGuard } from '../rate-limits.js';
import { createPublicSearchGuard } from '../search-guardrails.js';
import { createInMemoryPublicDataAccess } from './data-access.js';
import type { HandlerDeps } from './handlers.js';
import { createPublicApiRequestHandler, createPublicApiServer } from './server.js';
import { makeEntity, SAMPLE_POINTER } from './entity-fixture.js';

function makeDeps(): HandlerDeps {
  return {
    dataAccess: createInMemoryPublicDataAccess({
      pointer: SAMPLE_POINTER,
      entities: [makeEntity()],
    }),
    clientAttestationGuard: async ({ headers }: { headers: ClientAttestationHeaders }) => ({
      allowed: true,
      verified: Boolean((headers as Record<string, string | undefined>)['x-blackstory-client']),
      mode: 'monitor',
    }),
    rateLimitGuard: createPublicRateLimitGuard({ now: () => 1_800_000_000_000 }),
    searchGuard: createPublicSearchGuard(),
  };
}

interface Captured {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/** Minimal stand-ins for what a serverless runtime passes a Node function. */
function invoke(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
  method: string,
  url: string,
  headers: Record<string, string> = {},
): Promise<Captured> {
  const req = new EventEmitter() as IncomingMessage;
  req.method = method;
  req.url = url;
  req.headers = headers;
  // A serverless runtime hands the function a real socket; `clientIpFrom` reads it for the
  // rate limiter's key, so a stub without one is not a faithful stand-in.
  (req as { socket: { remoteAddress: string } }).socket = { remoteAddress: '203.0.113.10' };

  return new Promise((resolve) => {
    const chunks: string[] = [];
    const captured: Captured = { statusCode: 0, headers: {}, body: '' };
    const res = {
      statusCode: 0,
      writeHead(status: number, headers?: Record<string, string | number>) {
        captured.statusCode = status;
        for (const [name, value] of Object.entries(headers ?? {})) {
          captured.headers[name.toLowerCase()] = String(value);
        }
        return res;
      },
      setHeader(name: string, value: string | number) {
        captured.headers[name.toLowerCase()] = String(value);
      },
      write(chunk: string) {
        chunks.push(String(chunk));
        return true;
      },
      end(chunk?: string) {
        if (chunk !== undefined) chunks.push(String(chunk));
        captured.body = chunks.join('');
        resolve(captured);
        return res;
      },
    } as unknown as ServerResponse;

    handler(req, res);
    // A read request carries no body; end the stream so any body reader settles.
    req.emit('end');
  });
}

test('the handler serves /v1/health with no server and no listener', async () => {
  const res = await invoke(createPublicApiRequestHandler(makeDeps()), 'GET', '/v1/health');
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body) as { status: string; service: string };
  assert.equal(body.status, 'ok');
  assert.equal(body.service, 'api-public');
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.ok(res.headers['x-request-id']);
});

test('an unknown path is still a structured 404, not a thrown function', async () => {
  const res = await invoke(createPublicApiRequestHandler(makeDeps()), 'GET', '/v1/nope');
  assert.equal(res.statusCode, 404);
  assert.ok(JSON.parse(res.body));
});

test('the URL cap applies to the serverless host too', async () => {
  const handler = createPublicApiRequestHandler(makeDeps(), { limits: { maxUrlLength: 32 } });
  const res = await invoke(handler, 'GET', `/v1/search?q=${'a'.repeat(200)}`);
  assert.equal(res.statusCode, 414);
});

test('both hosts answer identically, so neither can drift from the other', async () => {
  const viaHandler = await invoke(createPublicApiRequestHandler(makeDeps()), 'GET', '/v1/health');

  const server = createPublicApiServer(makeDeps());
  server.listen(0);
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  try {
    const overSocket = await fetch(`http://127.0.0.1:${port}/v1/health`);
    assert.equal(overSocket.status, viaHandler.statusCode);
    const socketBody = (await overSocket.json()) as Record<string, unknown>;
    const handlerBody = JSON.parse(viaHandler.body) as Record<string, unknown>;
    assert.equal(socketBody.status, handlerBody.status);
    assert.equal(socketBody.service, handlerBody.service);
  } finally {
    server.close();
    await once(server, 'close');
  }
});
