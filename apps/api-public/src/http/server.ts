/**
 * `node:http` adapter — the real HTTP server entrypoint for `apps/api-public` (MOB-004).
 *
 * Framework choice (bead: "keep API framework choice minimal and documented; do not adopt a
 * framework solely for aesthetics"): the native Node `http` module + a tiny switch router
 * (`./router.ts`). Rationale in `./README.md` — no other `apps/*` in this repo pulls in Express/
 * Fastify/etc., the surface is five bounded GET routes, and every guard/rate-limit/redaction
 * concern already lives in reusable helpers, so a framework would add a dependency and a supply-
 * chain surface (threat model T8) without buying anything.
 *
 * This adapter is where the untrusted socket meets bounded parsing (threat model T3/adversarial
 * bead cases): URL length, request-body byte size, and JSON nesting depth are all capped BEFORE any
 * handler runs, and any unexpected throw becomes a stack-free `INTERNAL` 500.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { dispatch } from './router.js';
import type { HandlerDeps, ApiRequest } from './handlers.js';
import { errorResponse, newRequestId, type ApiResponse } from './responses.js';

export type PublicApiServerLimits = {
  /** Max full request-target (path + query) length. Defeats query bombs / cache-key confusion. */
  readonly maxUrlLength: number;
  /** Max request body size in bytes. Read endpoints carry no body; a large body is rejected. */
  readonly maxBodyBytes: number;
  /** Max JSON nesting depth accepted by `parseJsonWithDepthLimit` (depth-bomb defense). */
  readonly maxJsonDepth: number;
};

export const DEFAULT_LIMITS: PublicApiServerLimits = {
  maxUrlLength: 2048,
  maxBodyBytes: 64 * 1024,
  maxJsonDepth: 16,
};

export type PublicApiServerOptions = {
  readonly limits?: Partial<PublicApiServerLimits>;
  /** Injectable for deterministic tests. */
  readonly requestIdFactory?: () => string;
};

/**
 * Parses JSON while rejecting excessive nesting depth BEFORE building the object graph, so a
 * `[[[[...]]]]` / `{"a":{"a":{...}}}` depth bomb cannot exhaust the stack. Read endpoints have no
 * body today; this guards any body-bearing request the server drains and is the wired,
 * unit-tested defense for the bead's "JSON body exceeding a defined depth" adversarial case.
 */
export function parseJsonWithDepthLimit(text: string, maxDepth: number): unknown {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (const char of text) {
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{' || char === '[') {
      depth += 1;
      if (depth > maxDepth) {
        throw new RangeError(`JSON nesting depth exceeds limit of ${maxDepth}`);
      }
    } else if (char === '}' || char === ']') {
      depth -= 1;
    }
  }
  return JSON.parse(text);
}

/**
 * Drains the request body, rejecting once accumulated bytes exceed `maxBodyBytes` (fail fast — the
 * connection is not read to completion for an over-limit body). Returns the raw text.
 */
export function readBodyWithLimit(req: IncomingMessage, maxBodyBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > maxBodyBytes) {
      reject(new RangeError('body_too_large'));
      return;
    }
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBodyBytes) {
        reject(new RangeError('body_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function lowercaseHeaders(req: IncomingMessage): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    out[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
  }
  return out;
}

function clientIpFrom(req: IncomingMessage): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const first = raw?.split(',')[0]?.trim();
  return first || req.socket.remoteAddress || undefined;
}

function writeResponse(res: ServerResponse, method: string, response: ApiResponse): void {
  res.writeHead(response.status, response.headers);
  if (method === 'HEAD' || response.body === null) {
    res.end();
    return;
  }
  res.end(JSON.stringify(response.body));
}

/**
 * Builds the public API `node:http` server. All handler dependencies (data access, App Check guard,
 * rate limiter, search guard) are injected — construction touches no socket and no Firestore.
 */
export function createPublicApiServer(deps: HandlerDeps, options: PublicApiServerOptions = {}): Server {
  const limits: PublicApiServerLimits = { ...DEFAULT_LIMITS, ...options.limits };
  const makeRequestId = options.requestIdFactory ?? newRequestId;

  return createServer((req, res) => {
    void handle(req, res).catch(() => {
      // Last-resort guard: never leak an error detail/stack to the client.
      const requestId = makeRequestId();
      writeResponse(
        res,
        req.method ?? 'GET',
        errorResponse('INTERNAL', 'Unexpected server error.', { requestId }),
      );
    });
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const requestId = makeRequestId();
    const method = req.method ?? 'GET';
    const rawUrl = req.url ?? '/';

    if (rawUrl.length > limits.maxUrlLength) {
      writeResponse(res, method, {
        status: 414,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Request-Id': requestId,
        },
        body: { error: { code: 'INVALID_REQUEST', message: 'Request URL too long.', requestId } },
      });
      return;
    }

    // Reject an over-limit body before dispatch (413). Read endpoints expect none.
    try {
      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        await readBodyWithLimit(req, limits.maxBodyBytes);
      } else if (req.headers['content-length'] && Number(req.headers['content-length']) > limits.maxBodyBytes) {
        throw new RangeError('body_too_large');
      }
    } catch {
      writeResponse(res, method, {
        status: 413,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Request-Id': requestId,
        },
        body: { error: { code: 'INVALID_REQUEST', message: 'Request body too large.', requestId } },
      });
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl, 'http://localhost');
    } catch {
      writeResponse(res, method, errorResponse('INVALID_REQUEST', 'Malformed request URL.', { requestId }));
      return;
    }

    const clientIp = clientIpFrom(req);
    const request: ApiRequest = {
      method,
      path: parsed.pathname,
      query: parsed.searchParams,
      headers: lowercaseHeaders(req),
      requestId,
      ...(clientIp ? { clientIp } : {}),
    };

    const response = await dispatch(request, deps);
    writeResponse(res, method, response);
  }
}
