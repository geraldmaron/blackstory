/**
 * A search result is a lead.
 *
 * That sentence is the whole module. A query comes back with a URL, a title and a blurb written by
 * a search engine, and none of those three things is evidence about anything. The blurb is not the
 * page. The title is not the document's title. The URL has not been resolved, and may redirect
 * somewhere else, 404, or serve a login wall. A record that cites a search result cites a search
 * engine's guess about a page nobody retrieved.
 *
 * The repository had this backwards in the one place it mattered most: `harness-run` pushed raw
 * search-result URLs into `HarnessRawSubject.cites` and handed the search blurb to a model, which
 * was then asked to emit `citationUrl` picked "from cites list". A result became a citation without
 * anything ever fetching it.
 *
 * So this returns `SearchLead`, a type that cannot be mistaken for evidence, and deliberately does
 * NOT build `WebSearchCandidateRecord`s. That matters for the storage-rights gate as well as for
 * honesty: `assertStorageTermsConfirmed` guards PERSISTING a result, and holding leads in memory
 * for the length of one research step is not persistence. Keeping leads out of the normalizer means
 * the gate stays exactly where it belongs — between a result and a row — instead of being weakened
 * into a check on whether a query may run. The discovery campaign, which really does persist
 * candidates, still goes through `fetchSearxngWebSearch` and still trips the gate.
 *
 * THE BUDGET IS OPTIONAL AND ITS ABSENCE IS REPORTED. `evaluateWebSearchQueryBudget` needs a
 * campaign's query count and a monthly spend figure, and today no production caller holds either:
 * the overnight enrichment runner caps queries with an env variable instead. Demanding budget state
 * here would mean every caller inventing a campaign it does not have, and a guard over invented
 * numbers is worse than no guard because it reads as enforcement. Instead a caller that HAS a
 * campaign passes one and every query is gated before the socket opens; a caller that does not gets
 * `budgetEnforced: false` in the result, so the gap shows up in output rather than in nobody's
 * memory.
 */
import {
  evaluateWebSearchQueryBudget,
  type DailyBudgetEvaluator,
  type WebSearchBudgetDecision,
  type WebSearchBudgetState,
  type WebSearchCampaignBudgetPolicy,
} from './budget-guard.js';
import {
  buildBraveWebSearchUrl,
  BRAVE_API_KEY_HEADER,
  parseBraveSearchResponse,
} from './brave-client.js';
import { buildSearxngSearchUrl, parseSearxngSearchResponse } from './searxng-client.js';
import type { WebSearchParsedBatch, WebSearchProvider, WebSearchProviderConfig } from './types.js';
import { urlDedupeKey } from '../../urls/canonical-key.js';

/** The injection seam. Structurally the same as `SafeHttpClient`, and satisfied by
 *  `@repo/security`'s `createOperatorEndpointClient` for a private SearXNG. */
export type RoutedSearchHttpClient = (request: {
  readonly url: string;
  readonly method?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly allowedContentTypes?: readonly string[];
}) => Promise<{
  readonly status: number;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly bodyText: string;
  readonly finalUrl: string;
}>;

/** A bounded search to run. `needId`/`seeking` travel through from an enrichment plan when the
 *  query came from one, so a lead can be traced back to the evidence need that asked for it. */
export type RoutedSearchQuery = {
  readonly query: string;
  readonly needId?: string;
  readonly seeking?: string;
};

/**
 * An unresolved pointer. Named for what it is so that no caller can read it as a source.
 *
 * There is no `text`, no `snippet` and no `excerpt` field on purpose: the only text worth putting
 * in front of a model or a claim extractor is text that came back from fetching the page, and that
 * is what the safe-fetch gather step produces. A `description` from the engine is kept solely for
 * ranking and for an operator reading a report — never as page content.
 */
export type SearchLead = {
  readonly url: string;
  readonly title?: string;
  /** The SEARCH ENGINE's blurb. Not page content; never a quotation. */
  readonly engineDescription?: string;
  readonly provider: WebSearchProvider;
  readonly queryText: string;
  readonly executedAt: string;
  readonly needId?: string;
  readonly seeking?: string;
};

export type SkippedQuery = {
  readonly query: string;
  readonly reason: 'budget_denied' | 'provider_error' | 'non_success_status';
  readonly detail?: string;
};

export type RoutedWebSearchResult = {
  readonly provider: WebSearchProvider;
  readonly leads: readonly SearchLead[];
  readonly queriesIssued: number;
  readonly skipped: readonly SkippedQuery[];
  /**
   * False when no campaign budget was supplied. Reported rather than silently defaulted so that
   * "we did not enforce a budget" is visible in the run output.
   */
  readonly budgetEnforced: boolean;
  readonly budgetDecisions: readonly WebSearchBudgetDecision[];
  /** Results dropped because another query already returned the same page. */
  readonly duplicateLeadsDropped: number;
};

export type RoutedSearchBudget = {
  readonly policy: WebSearchCampaignBudgetPolicy;
  readonly state: WebSearchBudgetState;
  readonly evaluateDailyBudget: DailyBudgetEvaluator;
};

export type RunRoutedWebSearchInput = {
  readonly queries: readonly RoutedSearchQuery[];
  readonly config: WebSearchProviderConfig;
  readonly client: RoutedSearchHttpClient;
  /** Timestamp stamped onto every lead. Passed in so this module has no clock. */
  readonly executedAt: string;
  /** Per-query cap on leads kept. Breadth without depth is how a budget gets spent for nothing. */
  readonly maxLeadsPerQuery?: number;
  readonly budget?: RoutedSearchBudget;
  readonly categories?: string;
  readonly language?: string;
};

const DEFAULT_MAX_LEADS_PER_QUERY = 8;

function buildUrl(input: RunRoutedWebSearchInput, query: string): string {
  if (input.config.provider === 'brave') {
    return buildBraveWebSearchUrl({ query });
  }
  const baseUrl = input.config.baseUrl?.trim();
  if (!baseUrl) {
    throw new Error(
      'A SearXNG routed search needs WebSearchProviderConfig.baseUrl (from SEARXNG_BASE_URL)',
    );
  }
  return buildSearxngSearchUrl({
    baseUrl,
    query,
    ...(input.categories !== undefined ? { categories: input.categories } : {}),
    ...(input.language !== undefined ? { language: input.language } : {}),
  });
}

function requestHeaders(config: WebSearchProviderConfig): Record<string, string> {
  if (config.provider === 'brave') {
    if (!config.apiKey.trim()) {
      throw new Error('A Brave routed search needs BRAVE_SEARCH_API_KEY on config.apiKey');
    }
    return { [BRAVE_API_KEY_HEADER]: config.apiKey, accept: 'application/json' };
  }
  // A reverse-proxied SearXNG may sit behind a shared-secret token; a Tailscale-only instance
  // needs none, so an empty key is normal rather than an error.
  return config.apiKey.trim()
    ? { authorization: `Bearer ${config.apiKey}`, accept: 'application/json' }
    : { accept: 'application/json' };
}

function parseBatch(config: WebSearchProviderConfig, bodyText: string): WebSearchParsedBatch {
  const raw: unknown = JSON.parse(bodyText);
  return config.provider === 'brave'
    ? parseBraveSearchResponse(raw)
    : parseSearxngSearchResponse(raw);
}

/**
 * Runs a bounded list of queries through ONE injected client and returns leads.
 *
 * A query that fails is recorded in `skipped` and the rest still run: one engine hiccup should not
 * discard the other nine searches a plan asked for. A query denied by the budget stops that query
 * and every query after it, because a budget that is spent stays spent.
 */
export async function runRoutedWebSearch(
  input: RunRoutedWebSearchInput,
): Promise<RoutedWebSearchResult> {
  const maxLeads = input.maxLeadsPerQuery ?? DEFAULT_MAX_LEADS_PER_QUERY;
  const leads: SearchLead[] = [];
  const skipped: SkippedQuery[] = [];
  const budgetDecisions: WebSearchBudgetDecision[] = [];
  const seenPages = new Set<string>();
  let duplicateLeadsDropped = 0;
  let queriesIssued = 0;
  let budgetState = input.budget?.state;

  for (let index = 0; index < input.queries.length; index += 1) {
    const planned = input.queries[index]!;
    const query = planned.query.trim();
    if (!query) continue;

    if (input.budget !== undefined && budgetState !== undefined) {
      const decision = evaluateWebSearchQueryBudget({
        policy: input.budget.policy,
        state: budgetState,
        evaluateDailyBudget: input.budget.evaluateDailyBudget,
      });
      budgetDecisions.push(decision);
      if (!decision.allowed) {
        skipped.push({
          query,
          reason: 'budget_denied',
          ...(decision.reason !== undefined ? { detail: decision.reason } : {}),
        });
        // Every remaining query is denied for the same reason; say so once per query rather than
        // hammering the evaluator.
        for (const remaining of input.queries.slice(index + 1)) {
          if (remaining.query.trim()) {
            skipped.push({
              query: remaining.query.trim(),
              reason: 'budget_denied',
              ...(decision.reason !== undefined ? { detail: decision.reason } : {}),
            });
          }
        }
        break;
      }
    }

    let batch: WebSearchParsedBatch;
    try {
      const response = await input.client({
        url: buildUrl(input, query),
        method: 'GET',
        headers: requestHeaders(input.config),
        allowedContentTypes: ['application/json', 'text/json'],
      });
      if (response.status < 200 || response.status >= 300) {
        skipped.push({
          query,
          reason: 'non_success_status',
          detail: `HTTP ${response.status}`,
        });
        continue;
      }
      batch = parseBatch(input.config, response.bodyText);
    } catch (error) {
      skipped.push({
        query,
        reason: 'provider_error',
        detail: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    queriesIssued += 1;
    if (budgetState !== undefined) {
      budgetState = {
        queriesIssuedThisCampaign: budgetState.queriesIssuedThisCampaign + 1,
        queriesIssuedThisMonth: budgetState.queriesIssuedThisMonth + 1,
      };
    }

    let keptForThisQuery = 0;
    for (const result of batch.results) {
      if (keptForThisQuery >= maxLeads) break;
      // One page reached by two queries is one lead. Counting it twice is how a single document
      // starts looking like corroboration.
      const key = urlDedupeKey(result.url);
      if (key === undefined) continue;
      if (seenPages.has(key)) {
        duplicateLeadsDropped += 1;
        continue;
      }
      seenPages.add(key);
      keptForThisQuery += 1;
      leads.push({
        url: result.url,
        ...(result.title !== undefined ? { title: result.title } : {}),
        ...(result.description !== undefined ? { engineDescription: result.description } : {}),
        provider: input.config.provider,
        queryText: query,
        executedAt: input.executedAt,
        ...(planned.needId !== undefined ? { needId: planned.needId } : {}),
        ...(planned.seeking !== undefined ? { seeking: planned.seeking } : {}),
      });
    }
  }

  return {
    provider: input.config.provider,
    leads,
    queriesIssued,
    skipped,
    budgetEnforced: input.budget !== undefined,
    budgetDecisions,
    duplicateLeadsDropped,
  };
}

/**
 * Describes a routed run for an operator, naming what was NOT enforced.
 *
 * A run that reports only what it found teaches the next run nothing about what it skipped, and
 * "no budget was enforced" is the kind of fact that stays true for a year once it stops being
 * printed.
 */
export function describeRoutedSearch(result: RoutedWebSearchResult): string {
  const parts = [
    `${result.provider}: ${result.queriesIssued} quer${result.queriesIssued === 1 ? 'y' : 'ies'} issued`,
    `${result.leads.length} lead(s)`,
  ];
  if (result.duplicateLeadsDropped > 0) {
    parts.push(`${result.duplicateLeadsDropped} duplicate page(s) dropped`);
  }
  if (result.skipped.length > 0) {
    parts.push(`${result.skipped.length} quer(y|ies) skipped`);
  }
  parts.push(result.budgetEnforced ? 'campaign budget enforced' : 'NO campaign budget enforced');
  parts.push('leads are not evidence until independently fetched');
  return parts.join(', ');
}
