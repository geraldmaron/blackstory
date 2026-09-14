/**
 * repo-n7p6.17 (WS3 PATH 2) — reference traversal.
 *
 * The collectors fetch a page and stop. But the sources that actually tell a place's history are
 * usually one link away from the page that names it: a Wikipedia article's reference list, a
 * nomination form's bibliography, a state-encyclopedia entry's citations. Following those is the
 * difference between quoting an encyclopedia and piecing a history together.
 *
 * Everything in this module is pure. Link extraction, the host policy, the relevance gate, and
 * the budget arithmetic are all decided without touching the network, so the traversal rules are
 * unit-testable and the fetching loop stays a thin caller (it uses `safeFetchPage`, which carries
 * the SSRF and content-type protection — a crawler that follows arbitrary page links is exactly
 * the case that protection exists for).
 *
 * The rules, and why each one is here:
 *   - Depth is capped (default 2). This is a targeted walk from a known entity, not a crawl.
 *   - The fetch budget is SHARED across the whole walk, not per hop, so a page with eighty
 *     references cannot consume the batch.
 *   - Every hop target passes the same host policy as hop 0 (tier1-sources). Off-policy hosts
 *     are returned as leads — recorded for a human to consider promoting — never fetched as
 *     evidence. This is the Mizell pattern: a good new host becomes a reviewed policy addition,
 *     not a silent exception.
 *   - A link must corroborate the entity before it is worth a fetch. Without this the walk
 *     wanders off into general history within one hop, which is how a "research" pass ends up
 *     citing a page that never mentions the subject. Corroboration requires at least two
 *     distinct subject tokens (`MIN_RELEVANCE_SCORE`) found across the anchor, its surrounding
 *     context, OR the link target's own path/query — one token is usually just the place name
 *     recurring in a government site's own chrome, not a page that is actually about the subject.
 *   - A link must also look like a document, not a navigation surface (`isDocumentLikeUrl`).
 *     A town's staff directory, "welcome" home page, or search-results listing can still mention
 *     the subject's place name often enough to pass the relevance gate; requiring a document-like
 *     shape (a PDF, an item/article/record page, a marker or finding-aid page) is what actually
 *     separates a source about the subject from the site furniture around it.
 *   - Wikipedia and Wikidata are never hop targets. They are bridge sources by policy
 *     (`isWikipediaHost`) and the sweep already has a dedicated Wikipedia collector; following
 *     them again would re-derive the encyclopedia rather than reach past it.
 *   - Already-visited documents are skipped, and hosts already represented in the captured
 *     evidence sort last, because a fifth document from an agency already quoted adds far less
 *     than a first document from an independent one.
 */
import {
  hostLineageKey,
  isReputableSecondaryHost,
  isTier1Host,
  isWikipediaHost,
} from '../tier1-sources.ts';

export const DEFAULT_MAX_DEPTH = 2;
export const DEFAULT_FETCH_BUDGET = 10;
/** Tokens shorter than this carry no identifying signal ("the", "of", "st"). */
const MIN_SIGNIFICANT_TOKEN = 4;
/**
 * A candidate must match at least this many distinct subject tokens before it is worth a fetch.
 *
 * A single-token match is nearly always the place name (city/county/state) recurring in a
 * government site's own header, footer, or nav menu — every page on covingtonky.gov mentions
 * "Covington" — so a threshold of one made almost any link on the subject's home jurisdiction's
 * site look relevant. Requiring two distinct tokens means the page has to say something more
 * specific than "this site belongs to the subject's town."
 */
export const MIN_RELEVANCE_SCORE = 2;

export type HopCandidate = {
  /** Absolute URL, resolved against the page it was found on. */
  readonly url: string;
  readonly anchorText: string;
  /** Nearby text, used by the relevance gate when the anchor itself is bare ("[12]", "here"). */
  readonly context: string;
};

export type HopTier = 'tier1' | 'tier2';

export type PlannedHop = {
  readonly candidate: HopCandidate;
  readonly tier: HopTier;
  /** Count of distinct significant tokens from the subject matched in anchor or context. */
  readonly relevanceScore: number;
  /** False when this host already appears in the captured evidence set. */
  readonly newLineage: boolean;
};

export type HopRejection = {
  readonly candidate: HopCandidate;
  readonly reason:
    | 'off_policy'
    | 'bridge_source'
    | 'already_visited'
    | 'not_relevant'
    | 'navigational'
    | 'unparseable';
};

export type HopPlan = {
  /** In fetch order, already truncated to the remaining budget. */
  readonly follow: readonly PlannedHop[];
  /** Relevant, but on a host outside the policy: recorded for review, never fetched. */
  readonly leads: readonly HopCandidate[];
  readonly rejected: readonly HopRejection[];
};

export type HopSubject = {
  readonly displayName: string;
  readonly city?: string | undefined;
  readonly county?: string | undefined;
  readonly state?: string | undefined;
};

export type HopPlanInput = {
  readonly candidates: readonly HopCandidate[];
  readonly subject: HopSubject;
  /** Normalized document keys already fetched anywhere in this entity's walk. */
  readonly visited: ReadonlySet<string>;
  /** Hosts already represented in captured evidence; used only for ranking, never to reject. */
  readonly capturedHosts?: ReadonlySet<string>;
  /** Fetches still available for this entity across all hops. */
  readonly remainingFetches: number;
};

/** Stable key for "same document", so a walk cannot loop through query-string variants. */
export function documentKey(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    const path = parsed.pathname.replace(/\/$/u, '');
    return `${parsed.hostname.replace(/^www\./iu, '').toLowerCase()}${path}${parsed.search}`;
  } catch {
    return null;
  }
}

/**
 * Significant, lower-cased tokens identifying the subject: name words plus place words, minus
 * the generic descriptors that would match almost any local-history page ("house", "school",
 * "historic") and would turn the relevance gate into a rubber stamp.
 */
const GENERIC_TOKENS = new Set([
  'house',
  'home',
  'school',
  'high',
  'church',
  'building',
  'historic',
  'district',
  'site',
  'county',
  'street',
  'north',
  'south',
  'east',
  'west',
  'black',
  'african',
  'american',
  'national',
  'register',
  'places',
  'the',
  'and',
  'for',
]);

export function subjectTokens(subject: HopSubject): readonly string[] {
  const raw = [subject.displayName, subject.city, subject.county, subject.state]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ');
  const tokens = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gu, ' ')
    .split(/\s+/u)
    .filter((token) => token.length >= MIN_SIGNIFICANT_TOKEN && !GENERIC_TOKENS.has(token));
  return [...new Set(tokens)];
}

/** The link target's own path and query, decoded and despaced into a matchable text run. */
function linkTargetText(url: string): string {
  try {
    const parsed = new URL(url);
    return decodeURIComponent(`${parsed.pathname} ${parsed.search}`).replace(/[/_%+-]/gu, ' ');
  } catch {
    return '';
  }
}

/**
 * How many distinct subject tokens appear in the link's anchor text, its surrounding context, or
 * the link target's own path/query (a page slug such as "/item/tri-state-bank-memphis" or
 * "/nr-pdfs/berry-cemetery.pdf" names the subject as reliably as the anchor that points at it,
 * and does not inherit a government page's site-wide nav boilerplate the way the context window
 * can).
 *
 * This is a BUDGET filter, not the evidence gate. Some name tokens are weak on their own
 * ("state" out of "Tri-State Bank"), so a marginal link can still win a fetch. That costs one
 * fetch out of the entity's budget and nothing more: whatever comes back must still clear the
 * collector's identity corroboration and text-quality checks before it is stored as evidence,
 * and those are what stand between a wrong document and a false claim.
 */
export function relevanceScore(candidate: HopCandidate, tokens: readonly string[]): number {
  const haystack =
    `${candidate.anchorText} ${candidate.context} ${linkTargetText(candidate.url)}`.toLowerCase();
  return tokens.filter((token) => haystack.includes(token)).length;
}

/**
 * Path segments that mark a page as a navigation surface (a section, directory, or utility page)
 * rather than a document about anything in particular. Matched against the last segment of the
 * path (the page itself) and against every segment (a subsection nested under one of these, such
 * as "/police-department/staff", is still a staff directory).
 */
const NAV_PATH_SEGMENTS = new Set([
  'home',
  'index',
  'welcome',
  'about',
  'about-us',
  'contact',
  'contact-us',
  'staff',
  'directory',
  'department',
  'departments',
  'division',
  'divisions',
  'office',
  'offices',
  'program',
  'programs',
  'service',
  'services',
  'news',
  'events',
  'event',
  'calendar',
  'faq',
  'faqs',
  'search',
  'results',
  'result',
  'login',
  'signin',
  'sign-in',
  'logout',
  'register',
  'account',
  'accounts',
  'share',
  'sitemap',
  'privacy',
  'privacy-policy',
  'terms',
  'careers',
  'jobs',
  'category',
  'categories',
  'tag',
  'tags',
  'topic',
  'topics',
  'section',
  'sections',
  'precinct',
  'precincts',
]);

/**
 * Query-string parameters that mark a link as pagination or an in-site search, independent of
 * its path. Deliberately narrow: a tracking parameter such as `utm_source` tags a link a
 * newsletter or a social post pointed at real content, it does not make the destination a
 * navigation page, so it is not filtered here — a share or tracking link to a document should
 * still be followed for the document underneath it.
 */
const NAV_QUERY_PATTERN = /(?:^|[?&])(page|p|offset|start|s|q|query)=/iu;

/**
 * Path shapes strong enough to mark a link as document-like on their own, regardless of anything
 * in {@link NAV_PATH_SEGMENTS}: the survivors worth following (LOC photo records, state-inventory
 * PDFs, NPS place articles, hmdb marker pages) all look like one of these. Each pattern requiring
 * a following segment (an id or slug) is deliberate — a bare "/articles" or "/collections" with
 * nothing after it is the section's own index listing, not a specific document.
 */
const DOCUMENT_PATH_HINTS: readonly RegExp[] = [
  /\.pdf(?:$|[?#])/iu,
  /\/items?\/[^/?#]+/iu,
  /\/articles?\/[^/?#]+/iu,
  /finding[-_]?aid/iu,
  /\bnr[-_]?(?:pdfs?|detail|hp)\b/iu,
  /\bm\.asp\b/iu, // hmdb.org marker detail pages (m.asp?m=<id>)
  /\/markers?\/[^/?#]+/iu,
  /\/collections?\/[^/?#]+/iu,
  /\/objects?\/[^/?#]+/iu,
  /\/records?\/[^/?#]+/iu,
  /\/catalog\/[^/?#]+/iu,
  /\/detail\/[^/?#]+/iu,
];

/**
 * Restricts hops to URLs shaped like a specific document rather than a navigation surface.
 *
 * This is a shape check on the URL only — it knows nothing about the subject. It exists because
 * the relevance gate alone was not enough: a nav page for the subject's own town (a staff
 * directory, a "welcome to" home page, a search-results listing) legitimately mentions the
 * subject's place name throughout its chrome and can still clear a token-count threshold. Pairing
 * a document shape with the relevance score is what tells a police-department staff page apart
 * from a National Register nomination PDF on the same host.
 */
export function isDocumentLikeUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const path = parsed.pathname.toLowerCase();
  const search = parsed.search.toLowerCase();

  if (DOCUMENT_PATH_HINTS.some((pattern) => pattern.test(path) || pattern.test(search))) {
    return true;
  }
  if (NAV_QUERY_PATTERN.test(search)) return false;

  const segments = path.split('/').filter((segment) => segment.length > 0);
  if (segments.length === 0) return false; // bare root: a home page, not a document

  const stripExtension = (segment: string): string => segment.replace(/\.\w+$/u, '');
  return !segments.some((segment) => NAV_PATH_SEGMENTS.has(stripExtension(segment)));
}

/**
 * Pulls links out of a fetched page, resolving each against the page's own URL so relative
 * hrefs become absolute. Deliberately regex-based rather than a DOM parse: these pages are
 * frequently malformed scans-turned-HTML, and the only thing needed is href plus nearby text.
 */
export function extractReferenceLinks(html: string, baseUrl: string): readonly HopCandidate[] {
  const candidates: HopCandidate[] = [];
  const seen = new Set<string>();
  const anchorRe = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,300}?)<\/a>/giu;

  for (const match of html.matchAll(anchorRe)) {
    const href = match[1];
    const inner = match[2] ?? '';
    if (
      href === undefined ||
      href.startsWith('#') ||
      /^\s*(javascript|data|vbscript):/iu.test(href)
    )
      continue;

    let absolute: string;
    try {
      absolute = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }
    const key = documentKey(absolute);
    if (key === null || seen.has(key)) continue;
    seen.add(key);

    const anchorText = inner
      .replace(/<[^>]*>/gu, ' ')
      .replace(/\s+/gu, ' ')
      .trim();
    // Context window around the anchor: enough to catch "…the Tri-State Bank, see [12]…".
    const at = match.index ?? 0;
    const context = html
      .slice(Math.max(0, at - 300), Math.min(html.length, at + (match[0]?.length ?? 0) + 300))
      .replace(/<[^>]*>/gu, ' ')
      .replace(/\s+/gu, ' ')
      .trim();

    candidates.push({ url: absolute, anchorText, context });
  }
  return candidates;
}

/**
 * Decides which links are worth a fetch, in what order, within the remaining budget.
 *
 * Ordering: tier-1 government and archival hosts first, then reputable secondary hosts; within
 * a tier, links on hosts not already represented in the captured evidence come first (a first
 * independent source is worth more than a fifth from the same agency), then by how strongly the
 * link corroborates the subject.
 */
export function planReferenceHops(input: HopPlanInput): HopPlan {
  const tokens = subjectTokens(input.subject);
  const capturedHosts = input.capturedHosts ?? new Set<string>();
  const follow: PlannedHop[] = [];
  const leads: HopCandidate[] = [];
  const rejected: HopRejection[] = [];

  for (const candidate of input.candidates) {
    const key = documentKey(candidate.url);
    if (key === null) {
      rejected.push({ candidate, reason: 'unparseable' });
      continue;
    }
    if (input.visited.has(key)) {
      rejected.push({ candidate, reason: 'already_visited' });
      continue;
    }
    if (isWikipediaHost(candidate.url)) {
      rejected.push({ candidate, reason: 'bridge_source' });
      continue;
    }

    const score = relevanceScore(candidate, tokens);
    if (score < MIN_RELEVANCE_SCORE) {
      rejected.push({ candidate, reason: 'not_relevant' });
      continue;
    }
    if (!isDocumentLikeUrl(candidate.url)) {
      // A navigation surface is never worth reviewing, even relevant-scoring — unlike an
      // off-policy host, it is not a lead, just site furniture.
      rejected.push({ candidate, reason: 'navigational' });
      continue;
    }

    const tier: HopTier | null = isTier1Host(candidate.url)
      ? 'tier1'
      : isReputableSecondaryHost(candidate.url)
        ? 'tier2'
        : null;
    if (tier === null) {
      // Relevant but off-policy: a lead for review, never evidence.
      leads.push(candidate);
      rejected.push({ candidate, reason: 'off_policy' });
      continue;
    }

    const lineage = hostLineageKey(candidate.url);
    follow.push({
      candidate,
      tier,
      relevanceScore: score,
      newLineage: lineage === undefined || !capturedHosts.has(lineage),
    });
  }

  follow.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier === 'tier1' ? -1 : 1;
    if (a.newLineage !== b.newLineage) return a.newLineage ? -1 : 1;
    return b.relevanceScore - a.relevanceScore;
  });

  return {
    follow: follow.slice(0, Math.max(0, input.remainingFetches)),
    leads,
    rejected,
  };
}
