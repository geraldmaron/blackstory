/**
 * Production `SafeHttpClient` for the Census Geocoder adapter (`@black-book/domain`'s
 * `../adapters/census-geo/fetch-geocode.ts`), backed by the REAL URL-safety primitives
 * from `@black-book/security` (`evaluateExternalUrl`, `resolveAndPinDestination`) — the exact
 * seam `packages/domain/src/adapters/internet-archive/shared/http-port.ts` defines and
 * `http-port.test.ts`'s `buildRealSafeHttpClient` reference implementation demonstrates. This is
 * that reference implementation made real: DNS is resolved once via Node's `dns.promises`,
 * private/loopback/link-local/metadata answers are rejected before any socket opens, and the
 * TLS connection is made to the pinned IP while sending the original hostname for SNI and the
 * `Host` header never a second, unpinned DNS lookup.
 *
 * Server-only (Node `dns`/`https` modules) never import this from a Client Component or the
 * Edge runtime. GET-only: the Census Geocoder needs nothing else.
 */
import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import {
  evaluateExternalUrl,
  resolveAndPinDestination,
} from '@black-book/security';

/**
 * Structurally matches `@black-book/domain`'s `SafeHttpClient` port
 * (`packages/domain/src/adapters/internet-archive/shared/http-port.ts`) exactly including the
 * `'GET' | 'POST'` method union and optional `body` even though this client only ever performs
 * GET requests for the Census Geocoder (see `handleRequest`'s runtime guard below). Matching the
 * port's type shape (not narrowing it) is required for this client to satisfy `SafeHttpClient`
 * under `exactOptionalPropertyTypes`.
 */
export type SafeHttpMethod = 'GET' | 'POST';

export type SafeHttpRequest = {
  readonly url: string;
  readonly method?: SafeHttpMethod;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly allowedContentTypes?: readonly string[];
};

export type SafeHttpResponse = {
  readonly status: number;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly bodyText: string;
  readonly finalUrl: string;
};

const REQUEST_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

async function resolveHost(hostname: string) {
  const answers = await lookup(hostname, { all: true, verbatim: true });
  return answers.map((answer) => ({ address: answer.address, family: answer.family as 4 | 6 }));
}

function performPinnedRequest(input: {
  readonly normalizedUrl: string;
  readonly hostname: string;
  readonly port: number;
  readonly pinnedAddress: string;
  readonly headers: Readonly<Record<string, string>>;
}): Promise<SafeHttpResponse> {
  return new Promise((resolve, reject) => {
    const target = new URL(input.normalizedUrl);
    const req = httpsRequest(
      {
        host: input.pinnedAddress,
        port: input.port,
        path: `${target.pathname}${target.search}`,
        method: 'GET',
        servername: input.hostname,
        headers: { host: input.hostname, ...input.headers },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let byteLength = 0;
        res.on('data', (chunk: Buffer) => {
          byteLength += chunk.byteLength;
          if (byteLength > MAX_RESPONSE_BYTES) {
            req.destroy(new Error('response_too_large'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          const headers: Record<string, string | undefined> = {};
          for (const [key, value] of Object.entries(res.headers)) {
            headers[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
          }
          resolve({
            status: res.statusCode ?? 0,
            headers,
            bodyText: Buffer.concat(chunks).toString('utf8'),
            finalUrl: input.normalizedUrl,
          });
        });
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new Error('request_timeout')));
    req.on('error', reject);
    req.end();
  });
}

/** DNS-pinned `SafeHttpClient` for outbound Census Geocoder calls (server-only). */
export async function safeHttpClient(request: SafeHttpRequest): Promise<SafeHttpResponse> {
  if (request.method !== undefined && request.method !== 'GET') {
    throw new Error(`safeHttpClient only supports GET; got "${request.method}"`);
  }
  const parsed = evaluateExternalUrl(request.url, { allowedDomains: ['geocoding.geo.census.gov'] });
  if (!parsed.allowed) {
    throw new Error(`URL rejected by BB-030 policy: ${parsed.reason}`);
  }
  const destination = await resolveAndPinDestination(parsed.value, resolveHost);
  if (!destination.allowed) {
    throw new Error(`URL rejected by BB-030 DNS pinning: ${destination.reason}`);
  }
  return performPinnedRequest({
    normalizedUrl: destination.value.normalizedUrl,
    hostname: destination.value.hostname,
    port: destination.value.port,
    pinnedAddress: destination.value.pinnedAddress,
    headers: { accept: 'application/json', ...(request.headers ?? {}) },
  });
}
