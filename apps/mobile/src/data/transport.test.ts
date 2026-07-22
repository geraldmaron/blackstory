import {
  createTransport,
  createSupersedingRunner,
  parseRetryAfter,
  TransportError,
  type Transport,
} from './transport';
import type { ApiClient } from '../security/api-client';

/** Minimal Response-shaped double (transport only uses status/headers.get/text). */
function res(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
  return {
    status,
    headers: { get: (name: string) => lower[name.toLowerCase()] ?? null },
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

function clientFrom(handler: (path: string, opts: any) => Promise<Response>): {
  client: ApiClient;
  calls: { path: string; opts: any }[];
} {
  const calls: { path: string; opts: any }[] = [];
  const client: ApiClient = {
    request: (path, opts) => {
      calls.push({ path, opts });
      return handler(path, opts);
    },
  };
  return { client, calls };
}

function build(handler: (path: string, opts: any) => Promise<Response>, overrides = {}) {
  const { client, calls } = clientFrom(handler);
  const sleeps: number[] = [];
  const transport: Transport = createTransport({
    apiClient: client,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    random: () => 0.5,
    retry: { maxAttempts: 4, baseDelayMs: 300, maxDelayMs: 5000, maxRetryAfterMs: 30_000 },
    ...overrides,
  });
  return { transport, calls, sleeps };
}

describe('transport reads', () => {
  it('returns parsed JSON on 200 and surfaces the ETag', async () => {
    const { transport } = build(async () => res(200, { ok: true }, { etag: '"v1"' }));
    const r = await transport.readJson<{ ok: boolean }>('/v1/entity/x');
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.data.ok).toBe(true);
      expect(r.etag).toBe('"v1"');
    }
  });

  it('sends If-None-Match and returns not-modified on 304', async () => {
    const { transport, calls } = build(async () => res(304, null));
    const r = await transport.readJson('/v1/entity/x', { etag: '"v1"' });
    expect(calls[0].opts.headers['If-None-Match']).toBe('"v1"');
    expect(r.kind).toBe('not-modified');
  });

  it('retries retryable 503 then succeeds, respecting Retry-After', async () => {
    let n = 0;
    const { transport, sleeps, calls } = build(async () => {
      n++;
      return n === 1 ? res(503, 'busy', { 'retry-after': '2' }) : res(200, { ok: 1 });
    });
    const r = await transport.readJson('/v1/entity/x');
    expect(r.kind).toBe('ok');
    expect(calls).toHaveLength(2);
    expect(sleeps).toEqual([2000]); // Retry-After honoured, not jittered backoff
  });

  it('bounds a retry storm: fixed max attempts and bounded delays', async () => {
    const { transport, calls, sleeps } = build(async () => res(503, 'busy'));
    await expect(transport.readJson('/v1/entity/x')).rejects.toBeInstanceOf(TransportError);
    expect(calls).toHaveLength(4); // maxAttempts — never unbounded
    expect(sleeps).toHaveLength(3); // one sleep between each attempt
    for (const d of sleeps) expect(d).toBeLessThanOrEqual(5000); // maxDelayMs cap
  });

  it('does NOT retry a non-retryable 404', async () => {
    const { transport, calls } = build(async () => res(404, { error: {} }));
    await expect(transport.readJson('/v1/entity/x')).rejects.toMatchObject({ info: { status: 404 } });
    expect(calls).toHaveLength(1);
  });

  it('rejects an over-cap payload BEFORE parsing (declared Content-Length)', async () => {
    const { transport } = build(async () =>
      res(200, 'x', { 'content-length': String(50 * 1024 * 1024) }),
    );
    await expect(transport.readJson('/v1/entity/x')).rejects.toMatchObject({
      info: { kind: 'too-large' },
    });
  });

  it('rejects an over-cap body even when Content-Length is absent/lying', async () => {
    const big = 'a'.repeat(2048);
    const { transport } = build(async () => res(200, big), { maxResponseBytes: 1024 });
    await expect(transport.readJson('/v1/entity/x')).rejects.toMatchObject({
      info: { kind: 'too-large' },
    });
  });
});

describe('transport mutations', () => {
  it('NEVER retries a mutation, even on a retryable status', async () => {
    const { transport, calls } = build(async () => res(503, 'busy'));
    const r = await transport.mutate('/v1/corrections', { method: 'POST', body: '{}' });
    expect(r.status).toBe(503); // returned verbatim, not retried
    expect(calls).toHaveLength(1);
  });
});

describe('parseRetryAfter', () => {
  it('parses delta-seconds and HTTP-dates', () => {
    expect(parseRetryAfter('5')).toBe(5000);
    expect(parseRetryAfter(null)).toBeUndefined();
    const future = new Date(Date.now() + 10_000).toUTCString();
    const ms = parseRetryAfter(future);
    expect(ms).toBeGreaterThan(8000);
    expect(ms).toBeLessThanOrEqual(10_000);
  });
});

describe('superseding runner (cancellation)', () => {
  it('aborts the prior in-flight request when a new one starts', async () => {
    const run = createSupersedingRunner();
    let firstSignal: AbortSignal | undefined;
    let resolveFirst: () => void = () => {};

    const first = run<string>((signal) => {
      firstSignal = signal;
      return new Promise((resolve) => {
        signal.addEventListener('abort', () => resolve('aborted'));
        resolveFirst = () => resolve('done');
      });
    });

    // Start a second call — it must abort the first.
    const second = run<string>(async () => 'second');
    expect(firstSignal?.aborted).toBe(true);
    await expect(first).resolves.toBe('aborted');
    await expect(second).resolves.toBe('second');
    resolveFirst();
  });
});
