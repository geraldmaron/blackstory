/**
 * DNS-pinned SafeHttpClient for Census Geocoder calls from the operator CLI.
 * Mirrors apps/web/src/lib/geocode/safe-http-client.ts — Census hostname allowlist only.
 */
import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import type { SafeHttpClient, SafeHttpRequest, SafeHttpResponse } from '@repo/domain';
import { evaluateExternalUrl, resolveAndPinDestination } from '@repo/security/url-safety';

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

/** Production SafeHttpClient for geocoding.geo.census.gov only. */
export const censusSafeHttpClient: SafeHttpClient = async (
  request: SafeHttpRequest,
): Promise<SafeHttpResponse> => {
  if (request.method !== undefined && request.method !== 'GET') {
    throw new Error(`censusSafeHttpClient only supports GET; got "${request.method}"`);
  }
  const parsed = evaluateExternalUrl(request.url, { allowedDomains: ['geocoding.geo.census.gov'] });
  if (!parsed.allowed) {
    throw new Error(`URL rejected by safe-fetch policy: ${parsed.reason}`);
  }
  const destination = await resolveAndPinDestination(parsed.value, resolveHost);
  if (!destination.allowed) {
    throw new Error(`URL rejected by safe-fetch DNS pinning: ${destination.reason}`);
  }
  return performPinnedRequest({
    normalizedUrl: destination.value.normalizedUrl,
    hostname: destination.value.hostname,
    port: destination.value.port,
    pinnedAddress: destination.value.pinnedAddress,
    headers: { accept: 'application/json', ...(request.headers ?? {}) },
  });
};
