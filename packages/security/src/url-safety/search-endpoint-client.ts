/**
 * Talking to our own search box.
 *
 * The SSRF policy in ./policy.ts refuses private, loopback and carrier-grade-NAT addresses, and it
 * is right to: every other caller in this module hands it a URL that came out of a web page, and a
 * URL from a web page must never be able to reach an internal service. The operator's SearXNG is
 * the exception that proves the rule — it lives at http://127.0.0.1:8888, or on a Tailscale
 * 100.64.0.0/10 address, precisely so that it is NOT reachable from the internet. `executeSafeFetch`
 * therefore cannot call it, and never should be taught to: loosening the shared primitive would put
 * a private-address escape hatch under every untrusted-URL caller that depends on it.
 *
 * So this is a second, much smaller client with the opposite premise. It may only ever talk to ONE
 * origin, fixed when it is constructed, and it REQUIRES that origin to resolve to an address the
 * SSRF policy rejects. That requirement is not a restriction, it is the definition: a client whose
 * only reason to exist is reaching an endpoint the policy refuses has no business reaching one the
 * policy would have allowed. A publicly routable search endpoint must go through
 * `evaluateExternalUrl` + `resolveAndPinDestination` like everything else, and the error below says
 * so rather than leaving the caller to guess.
 *
 * WHAT THE ORIGIN CHECK ACTUALLY DEFENDS. Be honest about this, because overclaiming it is how it
 * stops being maintained. The request URL is normally built by appending a query to the configured
 * base, so its origin is DERIVED from the configured origin and the comparison is close to a
 * self-comparison. The check earns its place by catching a URL that did not come from the base at
 * all — a result URL handed to the wrong client, a caller that built a URL from a response field,
 * a later refactor that threads a caller-supplied URL through. The configured base URL remains the
 * trust root, and nothing here can make an operator's misconfiguration safe; it can only stop that
 * misconfiguration from being silent, which is why a public address is refused outright.
 *
 * NO RETRIES, deliberately. `packages/ops-data/scripts/lib/corroborate-source.ts` serializes its
 * searches 4s apart because bursts were observed to suspend every upstream engine the instance
 * queries. A retry loop inside this client would fire those bursts from inside that spacing and
 * undo it. Pacing and retry policy belong to the caller that knows the campaign, not to transport.
 *
 * NO REDIRECT FOLLOWING. A 3xx from our own search instance is a misconfiguration or worse, never
 * something to chase: `fetch`/undici follows redirects by default and `http.request` does not, so
 * this builds on `http.request` and fails closed on any 3xx rather than relying on a default.
 */
import { lookup } from 'node:dns/promises';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { canonicalHostname, isPublicIpAddress, type ResolveHost } from './policy.js';

/** Why a configured endpoint or a request was refused. Stable strings — tests and logs read them. */
export type OperatorEndpointDenialReason =
  | 'base_url_unparseable'
  | 'base_url_scheme_not_http'
  | 'base_url_opaque_origin'
  | 'base_url_carries_credentials'
  | 'base_url_carries_query_or_fragment'
  | 'base_url_resolution_failed'
  | 'base_url_address_is_public'
  | 'request_method_not_get'
  | 'request_url_unparseable'
  | 'request_origin_mismatch'
  | 'response_redirect'
  | 'response_content_type_not_allowed'
  | 'response_too_large'
  | 'request_timeout';

export class OperatorEndpointError extends Error {
  constructor(
    message: string,
    readonly reason: OperatorEndpointDenialReason,
  ) {
    super(message);
    this.name = 'OperatorEndpointError';
  }
}

/**
 * Structurally compatible with `@repo/domain`'s `SafeHttpRequest`/`SafeHttpResponse` so that a
 * client built here can be passed straight to the web-search adapters that take a `SafeHttpClient`.
 * Declared here rather than imported because `@repo/security` does not depend on `@repo/domain` —
 * the same port-mirroring this repository already uses for `DailyBudgetEvaluator`
 * (packages/domain/src/adapters/web-search/budget-guard.ts).
 */
export type OperatorEndpointRequest = {
  readonly url: string;
  /** GET only. Present so the type lines up with `SafeHttpRequest`; anything else is refused. */
  readonly method?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly allowedContentTypes?: readonly string[];
};

export type OperatorEndpointResponse = {
  readonly status: number;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly bodyText: string;
  readonly finalUrl: string;
};

export type OperatorEndpointClient = (
  request: OperatorEndpointRequest,
) => Promise<OperatorEndpointResponse>;

export type OperatorEndpointLimits = {
  readonly timeoutMs: number;
  readonly maxResponseBytes: number;
  readonly defaultAllowedContentTypes: readonly string[];
};

export const DEFAULT_OPERATOR_ENDPOINT_LIMITS: OperatorEndpointLimits = {
  timeoutMs: 15_000,
  maxResponseBytes: 4 * 1024 * 1024,
  defaultAllowedContentTypes: ['application/json', 'text/json'],
};

export type CreateOperatorEndpointClientInput = {
  /** The operator's own endpoint, e.g. `http://127.0.0.1:8888`. A path is allowed, for a
   *  reverse-proxied instance at `/searxng`; credentials, a query and a fragment are refused,
   *  because a base URL carrying `?` or `#` silently sends every request to `/`. */
  readonly baseUrl: string;
  /** Injected so tests never touch DNS. Defaults to the system resolver. */
  readonly resolveHost?: ResolveHost;
  readonly limits?: Partial<OperatorEndpointLimits>;
};

export type OperatorEndpoint = {
  readonly client: OperatorEndpointClient;
  /** The single origin this client will talk to, normalized. */
  readonly origin: string;
  /** Resolved once at construction and never re-resolved, so DNS cannot change under the check. */
  readonly pinnedAddress: string;
};

type NormalizedOrigin = {
  readonly protocol: 'http:' | 'https:';
  readonly hostname: string;
  readonly port: number;
};

function defaultPort(protocol: string): number {
  return protocol === 'https:' ? 443 : 80;
}

/**
 * Splits a URL into the three values an origin actually is. Compared as three values rather than
 * one string because `URL.origin` serializes every non-special scheme to the literal `"null"`,
 * which would make two unrelated opaque origins compare EQUAL, and because it silently drops
 * credentials, so `http://u:p@host/` and `http://host/` share an origin while sending very
 * different requests.
 */
function normalizeOrigin(
  raw: string,
  kind: 'base' | 'request',
):
  | { readonly ok: true; readonly value: NormalizedOrigin; readonly url: URL }
  | { readonly ok: false; readonly reason: OperatorEndpointDenialReason } {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return {
      ok: false,
      reason: kind === 'base' ? 'base_url_unparseable' : 'request_url_unparseable',
    };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      ok: false,
      reason: kind === 'base' ? 'base_url_scheme_not_http' : 'request_origin_mismatch',
    };
  }
  if (parsed.origin === 'null') {
    return {
      ok: false,
      reason: kind === 'base' ? 'base_url_opaque_origin' : 'request_origin_mismatch',
    };
  }
  if (parsed.username !== '' || parsed.password !== '') {
    return {
      ok: false,
      reason: kind === 'base' ? 'base_url_carries_credentials' : 'request_origin_mismatch',
    };
  }
  return {
    ok: true,
    url: parsed,
    value: {
      protocol: parsed.protocol,
      // canonicalHostname, not a local lower-case: it also unwraps IPv6 brackets and drops a
      // trailing dot, and isPublicIpAddress below folds ::ffff:127.0.0.1 onto its IPv4 form.
      hostname: canonicalHostname(parsed.hostname),
      port: parsed.port ? Number(parsed.port) : defaultPort(parsed.protocol),
    },
  };
}

function sameOrigin(left: NormalizedOrigin, right: NormalizedOrigin): boolean {
  return (
    left.protocol === right.protocol && left.hostname === right.hostname && left.port === right.port
  );
}

function normalizeHeaders(headers: IncomingMessage['headers']): Record<string, string | undefined> {
  const normalized: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
  }
  return normalized;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function contentTypeAllowed(
  headers: Readonly<Record<string, string | undefined>>,
  allowed: readonly string[],
): boolean {
  const raw = headers['content-type'];
  if (raw === undefined) return false;
  const essence = raw.split(';', 1)[0]!.trim().toLowerCase();
  return allowed.some((candidate) => candidate.toLowerCase() === essence);
}

const nodeResolveHost: ResolveHost = async (hostname) => {
  const answers = await lookup(hostname, { all: true, verbatim: true });
  return answers.map((answer) => ({ address: answer.address, family: answer.family as 4 | 6 }));
};

/**
 * Builds a client for ONE private, operator-configured endpoint. Throws `OperatorEndpointError`
 * rather than returning a result: a misconfigured search endpoint is a startup failure, and a
 * client that silently degrades to "no results" would read as "nothing was found".
 */
export async function createOperatorEndpointClient(
  input: CreateOperatorEndpointClientInput,
): Promise<OperatorEndpoint> {
  const limits: OperatorEndpointLimits = {
    ...DEFAULT_OPERATOR_ENDPOINT_LIMITS,
    ...(input.limits ?? {}),
  };
  const base = normalizeOrigin(input.baseUrl, 'base');
  if (!base.ok) {
    throw new OperatorEndpointError(
      `Operator search endpoint base URL rejected: ${base.reason} (${input.baseUrl})`,
      base.reason,
    );
  }
  if (base.url.search !== '' || base.url.hash !== '') {
    throw new OperatorEndpointError(
      `Operator search endpoint base URL must be an origin with no query or fragment: ${input.baseUrl}`,
      'base_url_carries_query_or_fragment',
    );
  }

  const { protocol, hostname, port } = base.value;
  let addresses: readonly string[];
  if (isIP(hostname)) {
    addresses = [hostname];
  } else {
    try {
      const answers = await (input.resolveHost ?? nodeResolveHost)(hostname);
      addresses = [...new Set(answers.map((answer) => canonicalHostname(answer.address)))].sort();
    } catch {
      addresses = [];
    }
    if (addresses.length === 0) {
      throw new OperatorEndpointError(
        `Could not resolve operator search endpoint host ${hostname}`,
        'base_url_resolution_failed',
      );
    }
  }
  // The whole premise: this client exists only for an endpoint the SSRF policy refuses. If the
  // policy would have allowed it, the caller is holding the wrong tool — and an operator whose
  // SEARXNG_BASE_URL has been pointed at a public address finds out here instead of never.
  const publicAddress = addresses.find((address) => isPublicIpAddress(address));
  if (publicAddress !== undefined) {
    throw new OperatorEndpointError(
      `Operator search endpoint ${hostname} resolves to the publicly routable address ` +
        `${publicAddress}. This client is only for an endpoint the SSRF policy refuses (loopback, ` +
        `private, or carrier-grade NAT). Reach a public endpoint through evaluateExternalUrl and ` +
        `resolveAndPinDestination instead.`,
      'base_url_address_is_public',
    );
  }
  const pinnedAddress = addresses[0]!;
  const origin = `${protocol}//${hostname}${port === defaultPort(protocol) ? '' : `:${port}`}`;

  const client: OperatorEndpointClient = async (request) => {
    if (request.method !== undefined && request.method !== 'GET') {
      throw new OperatorEndpointError(
        `Operator search endpoint client is GET-only; got "${request.method}"`,
        'request_method_not_get',
      );
    }
    const target = normalizeOrigin(request.url, 'request');
    if (!target.ok) {
      throw new OperatorEndpointError(
        `Operator search endpoint request URL rejected: ${target.reason}`,
        target.reason,
      );
    }
    if (!sameOrigin(target.value, base.value)) {
      throw new OperatorEndpointError(
        `Operator search endpoint client refuses ${target.value.protocol}//${target.value.hostname}:${target.value.port}; ` +
          `it may only call ${origin}`,
        'request_origin_mismatch',
      );
    }
    const allowedContentTypes = request.allowedContentTypes ?? limits.defaultAllowedContentTypes;
    const response = await performRequest({
      url: target.url,
      hostname,
      port,
      pinnedAddress,
      protocol,
      headers: { accept: 'application/json', ...(request.headers ?? {}) },
      limits,
    });
    if (REDIRECT_STATUSES.has(response.status)) {
      throw new OperatorEndpointError(
        `Operator search endpoint returned ${response.status}; redirects are never followed`,
        'response_redirect',
      );
    }
    if (!contentTypeAllowed(response.headers, allowedContentTypes)) {
      throw new OperatorEndpointError(
        `Operator search endpoint returned content-type "${
          response.headers['content-type'] ?? 'none'
        }"; expected one of ${allowedContentTypes.join(', ')}`,
        'response_content_type_not_allowed',
      );
    }
    return response;
  };

  return { client, origin, pinnedAddress };
}

/** Connects to the pinned address and never re-resolves the hostname. */
function performRequest(input: {
  readonly url: URL;
  readonly hostname: string;
  readonly port: number;
  readonly pinnedAddress: string;
  readonly protocol: 'http:' | 'https:';
  readonly headers: Readonly<Record<string, string>>;
  readonly limits: OperatorEndpointLimits;
}): Promise<OperatorEndpointResponse> {
  return new Promise((resolve, reject) => {
    const requester = input.protocol === 'https:' ? httpsRequest : httpRequest;
    const clientRequest = requester(
      {
        host: input.pinnedAddress,
        port: input.port,
        path: `${input.url.pathname}${input.url.search}`,
        method: 'GET',
        // SNI and Host stay the configured hostname even though the socket goes to the pinned
        // address, so a TLS-fronted instance still validates.
        servername: input.protocol === 'https:' ? input.hostname : undefined,
        headers: { host: input.hostname, ...input.headers },
        timeout: input.limits.timeoutMs,
      },
      (response) => {
        const chunks: Buffer[] = [];
        let byteLength = 0;
        response.on('data', (chunk: Buffer) => {
          byteLength += chunk.byteLength;
          if (byteLength > input.limits.maxResponseBytes) {
            clientRequest.destroy(
              new OperatorEndpointError(
                `Operator search endpoint response exceeded ${input.limits.maxResponseBytes} bytes`,
                'response_too_large',
              ),
            );
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => {
          resolve({
            status: response.statusCode ?? 0,
            headers: normalizeHeaders(response.headers),
            bodyText: Buffer.concat(chunks).toString('utf8'),
            finalUrl: input.url.toString(),
          });
        });
        response.on('error', reject);
      },
    );
    clientRequest.on('timeout', () =>
      clientRequest.destroy(
        new OperatorEndpointError(
          `Operator search endpoint did not respond within ${input.limits.timeoutMs}ms`,
          'request_timeout',
        ),
      ),
    );
    clientRequest.on('error', reject);
    clientRequest.end();
  });
}
