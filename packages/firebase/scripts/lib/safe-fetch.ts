/**
 * General-purpose safe outbound fetch for the research pipeline, backed by the
 * REAL `@repo/security` URL-safety primitives (DNS pinned once, private/
 * loopback/link-local/metadata answers rejected before any socket opens, TLS
 * SNI/Host sent for the original hostname while connecting to the pinned IP —
 * never a second, unpinned DNS lookup). This is `executeSafeFetch`
 * (packages/security/src/url-safety/fetch.ts) wired with a transport, the
 * SAME pattern `apps/web/src/lib/geocode/safe-http-client.ts` uses for the
 * Census Geocoder, generalized to arbitrary external hosts (no fixed
 * `allowedDomains` list) with an http-or-https transport instead of https-only.
 *
 * Why this exists as a *second* implementation instead of importing the Census
 * one: `packages/firebase` cannot import from `apps/web`, and the Census
 * client is intentionally narrow (HTTPS-only, one allowlisted host). Every
 * research-pipeline script that fetches an external URL — a subject's own
 * citation, a Wikipedia page's outbound references, a SearXNG search result —
 * MUST go through this, never a bare `fetch()`: those URLs are scraped from
 * untrusted pages, exactly the SSRF surface `executeSafeFetch` exists to
 * close, and this process also talks to local services (Ollama, SearXNG) that
 * an unpinned request could be tricked into hitting.
 */
import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import {
  executeSafeFetch,
  parseContentInSandbox,
  type PinnedTransportRequest,
  type PinnedTransportResponse,
  type SafeFetchResult,
  type SafeParserResult,
} from '@repo/security/url-safety';

async function resolveHost(hostname: string) {
  const answers = await lookup(hostname, { all: true, verbatim: true });
  return answers.map((answer) => ({ address: answer.address, family: answer.family as 4 | 6 }));
}

function performPinnedRequest(input: PinnedTransportRequest): Promise<PinnedTransportResponse> {
  return new Promise((resolve, reject) => {
    const target = new URL(input.url);
    const requestFn = target.protocol === 'http:' ? httpRequest : httpsRequest;
    const req = requestFn(
      {
        host: input.pinnedAddress,
        port: input.port,
        path: `${target.pathname}${target.search}`,
        method: 'GET',
        servername: target.protocol === 'https:' ? input.hostname : undefined,
        headers: { host: input.hostname, ...input.headers },
        timeout: 15_000,
        signal: input.signal,
      },
      (res) => {
        resolve({
          status: res.statusCode ?? 0,
          headers: Object.fromEntries(
            Object.entries(res.headers).map(([key, value]) => [
              key.toLowerCase(),
              Array.isArray(value) ? value.join(', ') : value,
            ]),
          ),
          remoteAddress: input.pinnedAddress,
          body: res,
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('request_timeout')));
    req.on('error', reject);
    req.end();
  });
}

type ParserWithRawHtml = SafeParserResult & { readonly rawHtml: string };

/**
 * Wraps the real `parseContentInSandbox` (same malware-signature checks, not
 * reimplemented) and additionally keeps the pre-strip decoded text, needed to
 * find a page's own outbound citation links (`extractedText` has already had
 * every tag removed).
 */
async function parseKeepingRawHtml(content: Uint8Array, contentType: string): Promise<ParserWithRawHtml> {
  const result = await parseContentInSandbox(content, contentType);
  const rawHtml = new TextDecoder('utf-8', { fatal: false }).decode(content);
  return { ...result, rawHtml };
}

export type SafeFetchedPage = { readonly html: string; readonly text: string; readonly finalUrl: string };

/**
 * Safely fetches `url` and returns its decoded text, or `undefined` if the
 * URL is rejected by policy, unreachable, too large, wrong content type, or
 * trips a malware indicator. Never throws — every research-pipeline caller
 * treats "couldn't get this source" as a normal, expected outcome.
 */
export async function safeFetchText(
  url: string,
  options: { readonly allowedContentTypes?: readonly string[] } = {},
): Promise<{ readonly text: string; readonly finalUrl: string } | undefined> {
  const page = await safeFetchPage(url, options);
  return page ? { text: page.text, finalUrl: page.finalUrl } : undefined;
}

/** Same as `safeFetchText` but also returns the raw HTML, for citation-link extraction. */
export async function safeFetchPage(
  url: string,
  options: { readonly allowedContentTypes?: readonly string[] } = {},
): Promise<SafeFetchedPage | undefined> {
  const result: SafeFetchResult = await executeSafeFetch(
    url,
    { resolveHost, transport: performPinnedRequest, parser: parseKeepingRawHtml },
    options.allowedContentTypes ? { limits: { allowedContentTypes: options.allowedContentTypes } } : {},
  );
  if (!result.ok || !result.parser.safe) return undefined;
  const parser = result.parser as ParserWithRawHtml;
  return { html: parser.rawHtml, text: parser.extractedText, finalUrl: result.finalUrl };
}
