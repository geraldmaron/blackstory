/**
 * The CLI's one way to reach a search provider.
 *
 * Provider selection, the env reads behind it, and client construction all live here, so that no
 * verb decides for itself how to talk to a search engine. A verb asks for queries to be run and
 * gets leads back.
 *
 * TWO PROVIDERS NEED TWO DIFFERENT KINDS OF CLIENT, and the difference is the whole reason this
 * module exists rather than a single helper:
 *
 *  - SearXNG is ours and private. It answers on loopback or a Tailscale 100.64/10 address, which
 *    the SSRF policy refuses by design, so it gets the origin-pinned operator-endpoint client from
 *    `@repo/security/url-safety` that exists for exactly that case.
 *  - Brave is a public API on api.search.brave.com. The private-endpoint client would refuse it,
 *    correctly, because it requires a non-public address. So Brave gets an ordinary DNS-pinned
 *    client with a one-host allowlist, the same shape as census-http.ts and wayback-http.ts.
 *
 * Every query runs through `runRoutedWebSearch`, so what comes back is leads. Nothing here fetches
 * a lead, and nothing here turns one into evidence; that is the caller's next step and it goes
 * through safe-fetch.
 */
import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import {
  runRoutedWebSearch,
  type RoutedSearchBudget,
  type RoutedSearchHttpClient,
  type RoutedSearchQuery,
  type RoutedWebSearchResult,
  type WebSearchProvider,
  type WebSearchProviderConfig,
} from '@repo/domain';
import {
  createOperatorEndpointClient,
  evaluateExternalUrl,
  resolveAndPinDestination,
} from '@repo/security/url-safety';

const BRAVE_API_HOST = 'api.search.brave.com';
const BRAVE_TIMEOUT_MS = 15_000;
const BRAVE_MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

export const SEARXNG_PLAN_TERMS_VERSION = 'searxng-self-hosted-research-2026-07';
export const BRAVE_PLAN_TERMS_VERSION = 'brave-storage-rights-tier-2026-07';

/** What the environment has to say about search. Read in one place so no verb reads it again. */
export type SearchProviderEnvironment = {
  readonly SEARXNG_BASE_URL?: string | undefined;
  readonly SEARXNG_AUTH_TOKEN?: string | undefined;
  readonly BRAVE_SEARCH_API_KEY?: string | undefined;
  readonly DISCOVERY_WEB_SEARCH_PROVIDER?: string | undefined;
};

export type ResolvedSearchProvider =
  | {
      readonly available: true;
      readonly provider: WebSearchProvider;
      readonly config: WebSearchProviderConfig;
      readonly client: RoutedSearchHttpClient;
      /** For a SearXNG endpoint, the address the client is pinned to. Worth printing once. */
      readonly pinnedAddress?: string;
    }
  | {
      readonly available: false;
      /** Why no provider could be used, in words an operator can act on. */
      readonly reason: string;
    };

/** Production SafeHttpClient for api.search.brave.com only. Mirrors census-http.ts. */
const braveSearchClient: RoutedSearchHttpClient = async (request) => {
  if (request.method !== undefined && request.method !== 'GET') {
    throw new Error(`braveSearchClient only supports GET; got "${request.method}"`);
  }
  const parsed = evaluateExternalUrl(request.url, { allowedDomains: [BRAVE_API_HOST] });
  if (!parsed.allowed) {
    throw new Error(`Brave search URL rejected by safe-fetch policy: ${parsed.reason}`);
  }
  const destination = await resolveAndPinDestination(parsed.value, async (hostname) => {
    const answers = await lookup(hostname, { all: true, verbatim: true });
    return answers.map((answer) => ({ address: answer.address, family: answer.family as 4 | 6 }));
  });
  if (!destination.allowed) {
    throw new Error(`Brave search URL rejected by safe-fetch DNS pinning: ${destination.reason}`);
  }
  const allowedContentTypes = request.allowedContentTypes ?? ['application/json', 'text/json'];
  const target = new URL(destination.value.normalizedUrl);
  return new Promise((resolve, reject) => {
    const clientRequest = httpsRequest(
      {
        host: destination.value.pinnedAddress,
        port: destination.value.port,
        path: `${target.pathname}${target.search}`,
        method: 'GET',
        servername: destination.value.hostname,
        // Pinned Host last: a caller-supplied `host` must not override the allowlisted one.
        headers: { ...(request.headers ?? {}), host: destination.value.hostname },
        timeout: BRAVE_TIMEOUT_MS,
      },
      (response) => {
        const chunks: Buffer[] = [];
        let byteLength = 0;
        response.on('data', (chunk: Buffer) => {
          byteLength += chunk.byteLength;
          if (byteLength > BRAVE_MAX_RESPONSE_BYTES) {
            clientRequest.destroy(new Error('brave_response_too_large'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => {
          const headers: Record<string, string | undefined> = {};
          for (const [key, value] of Object.entries(response.headers)) {
            headers[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
          }
          // The caller declares what it will accept; honour it rather than trusting the body to
          // be what was asked for. wayback-http.ts and the operator-endpoint client both assert
          // this, and a Brave error page served as HTML must not be parsed as a result set.
          const essence = (headers['content-type'] ?? '').split(';', 1)[0]!.trim().toLowerCase();
          if (essence === '' || !allowedContentTypes.some((c) => c.toLowerCase() === essence)) {
            reject(
              new Error(
                `Brave search returned content-type "${headers['content-type'] ?? 'none'}"; ` +
                  `expected one of ${allowedContentTypes.join(', ')}`,
              ),
            );
            return;
          }
          resolve({
            status: response.statusCode ?? 0,
            headers,
            bodyText: Buffer.concat(chunks).toString('utf8'),
            finalUrl: destination.value.normalizedUrl,
          });
        });
        response.on('error', reject);
      },
    );
    clientRequest.on('timeout', () => clientRequest.destroy(new Error('brave_request_timeout')));
    clientRequest.on('error', reject);
    clientRequest.end();
  });
};

/**
 * Works out which provider is usable and builds its client.
 *
 * Returns a reason rather than throwing when none is configured: a harness run with no search
 * endpoint should carry on with its other connectors and say that search was unavailable, not die.
 * A CONFIGURED endpoint that turns out to be unusable is a different matter and the reason says
 * which — an operator who set SEARXNG_BASE_URL to something public needs to see that sentence.
 */
export async function resolveSearchProvider(
  environment: SearchProviderEnvironment,
  options: { readonly prefer?: WebSearchProvider } = {},
): Promise<ResolvedSearchProvider> {
  const searxngBase = environment.SEARXNG_BASE_URL?.trim();
  const braveKey = environment.BRAVE_SEARCH_API_KEY?.trim();
  const token = environment.SEARXNG_AUTH_TOKEN?.trim() ?? '';
  const preferBrave =
    options.prefer === 'brave' || environment.DISCOVERY_WEB_SEARCH_PROVIDER?.trim() === 'brave';

  // provider-decision.ts chose SearXNG; Brave stays a fallback, and an explicit preference wins.
  if (!preferBrave && searxngBase) {
    try {
      const endpoint = await createOperatorEndpointClient({ baseUrl: searxngBase });
      return {
        available: true,
        provider: 'searxng',
        pinnedAddress: endpoint.pinnedAddress,
        client: endpoint.client,
        config: {
          provider: 'searxng',
          apiKey: token,
          // Leads are not persisted, so this gate is not the thing standing between a query and a
          // row; normalizeWebSearchBatch still holds that line for anything that becomes a record.
          storageTermsConfirmed: false,
          planTermsVersion: SEARXNG_PLAN_TERMS_VERSION,
          baseUrl: searxngBase,
        },
      };
    } catch (error) {
      return {
        available: false,
        reason: `SEARXNG_BASE_URL is set but unusable: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  if (braveKey) {
    return {
      available: true,
      provider: 'brave',
      client: braveSearchClient,
      config: {
        provider: 'brave',
        apiKey: braveKey,
        storageTermsConfirmed: false,
        planTermsVersion: BRAVE_PLAN_TERMS_VERSION,
      },
    };
  }

  if (preferBrave && searxngBase) {
    return {
      available: false,
      reason:
        'DISCOVERY_WEB_SEARCH_PROVIDER=brave was requested but BRAVE_SEARCH_API_KEY is not set; ' +
        'unset the preference to use the configured SearXNG instance',
    };
  }

  return {
    available: false,
    reason:
      'No search provider configured: set SEARXNG_BASE_URL for the operator instance (preferred) ' +
      'or BRAVE_SEARCH_API_KEY to fall back to Brave',
  };
}

export type RunSearchQueriesResult =
  | (RoutedWebSearchResult & { readonly available: true })
  | { readonly available: false; readonly reason: string };

/**
 * Resolves a provider and runs a bounded list of queries, returning leads.
 *
 * The caller still has to fetch every lead through safe-fetch before any of it can support a
 * claim. Nothing in this return value is a source.
 */
export async function runSearchQueries(input: {
  readonly queries: readonly RoutedSearchQuery[];
  readonly environment: SearchProviderEnvironment;
  readonly executedAt: string;
  readonly prefer?: WebSearchProvider;
  readonly maxLeadsPerQuery?: number;
  readonly budget?: RoutedSearchBudget;
  /** Injected for tests; production resolves from the environment. */
  readonly resolved?: ResolvedSearchProvider;
}): Promise<RunSearchQueriesResult> {
  const resolved =
    input.resolved ??
    (await resolveSearchProvider(
      input.environment,
      input.prefer !== undefined ? { prefer: input.prefer } : {},
    ));
  if (!resolved.available) {
    return { available: false, reason: resolved.reason };
  }
  const result = await runRoutedWebSearch({
    queries: input.queries,
    config: resolved.config,
    client: resolved.client,
    executedAt: input.executedAt,
    ...(input.maxLeadsPerQuery !== undefined ? { maxLeadsPerQuery: input.maxLeadsPerQuery } : {}),
    ...(input.budget !== undefined ? { budget: input.budget } : {}),
  });
  return { ...result, available: true };
}
