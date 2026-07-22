/**
 * `node:http` adapter for api-submissions corrections intake (MOB-016 / repo-zir9).
 *
 * Framework choice matches `apps/api-public`: native Node `http` + a tiny switch router.
 * This adapter caps URL length, body size, and JSON nesting depth before any handler runs.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { dispatch } from './router.js';
import type { HandlerDeps, ApiRequest } from './handlers.js';
import { jsonError, newRequestId, type ApiResponse } from './responses.js';

export type SubmissionsApiServerLimits = {
  readonly maxUrlLength: number;
  readonly maxBodyBytes: number;
  readonly maxJsonDepth: number;
};

export const DEFAULT_LIMITS: SubmissionsApiServerLimits = {
  maxUrlLength: 2048,
  maxBodyBytes: 64 * 1024,
  maxJsonDepth: 16,
};

export type SubmissionsApiServerOptions = {
  readonly limits?: Partial<SubmissionsApiServerLimits>;
  readonly requestIdFactory?: () => string;
};

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
  if (method === 'HEAD' || response.body === null || response.body === undefined) {
    res.end();
    return;
  }
  res.end(JSON.stringify(response.body));
}

function internalError(requestId: string): ApiResponse {
  return jsonError(500, 'internal_error', requestId);
}

export function createSubmissionsApiServer(
  deps: HandlerDeps,
  options: SubmissionsApiServerOptions = {},
): Server {
  const limits: SubmissionsApiServerLimits = { ...DEFAULT_LIMITS, ...options.limits };
  const makeRequestId = options.requestIdFactory ?? newRequestId;

  return createServer((req, res) => {
    void handle(req, res).catch(() => {
      const requestId = makeRequestId();
      writeResponse(res, req.method ?? 'GET', internalError(requestId));
    });
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const requestId = makeRequestId();
    const method = req.method ?? 'GET';
    const rawUrl = req.url ?? '/';

    if (rawUrl.length > limits.maxUrlLength) {
      writeResponse(res, method, jsonError(414, 'invalid_request', requestId));
      return;
    }

    let rawBody: string | undefined;
    try {
      if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        rawBody = await readBodyWithLimit(req, limits.maxBodyBytes);
      } else if (req.headers['content-length'] && Number(req.headers['content-length']) > limits.maxBodyBytes) {
        throw new RangeError('body_too_large');
      }
    } catch {
      writeResponse(res, method, jsonError(413, 'invalid_request', requestId));
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl, 'http://localhost');
    } catch {
      writeResponse(res, method, jsonError(400, 'invalid_request', requestId));
      return;
    }

    let body: unknown;
    if (rawBody !== undefined && rawBody.trim()) {
      try {
        body = parseJsonWithDepthLimit(rawBody, limits.maxJsonDepth);
      } catch {
        writeResponse(res, method, jsonError(400, 'invalid_json', requestId));
        return;
      }
    }

    const clientIp = clientIpFrom(req);
    const request: ApiRequest = {
      method,
      path: parsed.pathname,
      query: parsed.searchParams,
      headers: lowercaseHeaders(req),
      requestId,
      ...(clientIp ? { clientIp } : {}),
      ...(body !== undefined ? { body } : {}),
    };

    const response = await dispatch(request, deps);
    writeResponse(res, method, response);
  }
}
