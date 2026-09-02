/**
 * DNS-pinned SafeHttpClient for Wayback SPN2 (POST /save and GET /save/status).
 * Host allowlist is web.archive.org only. Mirrors census-http.ts with POST + body.
 */
import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import {
  assertAllowedContentType,
  type SafeHttpClient,
  type SafeHttpRequest,
  type SafeHttpResponse,
} from '@repo/domain';
import { evaluateExternalUrl, resolveAndPinDestination } from '@repo/security/url-safety';

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const WAYBACK_HOSTS = ['web.archive.org'] as const;

async function resolveHost(hostname: string) {
  const answers = await lookup(hostname, { all: true, verbatim: true });
  return answers.map((answer) => ({ address: answer.address, family: answer.family as 4 | 6 }));
}

function performPinnedRequest(input: {
  readonly method: 'GET' | 'POST';
  readonly normalizedUrl: string;
  readonly hostname: string;
  readonly port: number;
  readonly pinnedAddress: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
}): Promise<SafeHttpResponse> {
  return new Promise((resolve, reject) => {
    const target = new URL(input.normalizedUrl);
    const requester = target.protocol === 'https:' ? httpsRequest : httpRequest;
    const headers: Record<string, string> = { host: input.hostname, ...input.headers };
    if (input.body !== undefined && headers['content-length'] === undefined) {
      headers['content-length'] = String(Buffer.byteLength(input.body));
    }
    const req = requester(
      {
        host: input.pinnedAddress,
        port: input.port,
        path: `${target.pathname}${target.search}`,
        method: input.method,
        servername: target.protocol === 'https:' ? input.hostname : undefined,
        headers,
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
          const responseHeaders: Record<string, string | undefined> = {};
          for (const [key, value] of Object.entries(res.headers)) {
            responseHeaders[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
          }
          resolve({
            status: res.statusCode ?? 0,
            headers: responseHeaders,
            bodyText: Buffer.concat(chunks).toString('utf8'),
            finalUrl: input.normalizedUrl,
          });
        });
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new Error('request_timeout')));
    req.on('error', reject);
    if (input.body !== undefined) {
      req.write(input.body);
    }
    req.end();
  });
}

/** Production SafeHttpClient for web.archive.org SPN2 only. */
export const waybackSafeHttpClient: SafeHttpClient = async (
  request: SafeHttpRequest,
): Promise<SafeHttpResponse> => {
  const method = request.method ?? 'GET';
  if (method !== 'GET' && method !== 'POST') {
    throw new Error(`waybackSafeHttpClient only supports GET and POST; got "${String(method)}"`);
  }
  const parsed = evaluateExternalUrl(request.url, { allowedDomains: WAYBACK_HOSTS });
  if (!parsed.allowed) {
    throw new Error(`URL rejected by safe-fetch policy: ${parsed.reason}`);
  }
  const destination = await resolveAndPinDestination(parsed.value, resolveHost);
  if (!destination.allowed) {
    throw new Error(`URL rejected by safe-fetch DNS pinning: ${destination.reason}`);
  }
  const response = await performPinnedRequest({
    method,
    normalizedUrl: destination.value.normalizedUrl,
    hostname: destination.value.hostname,
    port: destination.value.port,
    pinnedAddress: destination.value.pinnedAddress,
    headers: request.headers ?? {},
    ...(request.body !== undefined ? { body: request.body } : {}),
  });
  if (request.allowedContentTypes && request.allowedContentTypes.length > 0) {
    assertAllowedContentType(response, request.allowedContentTypes);
  }
  return response;
};
