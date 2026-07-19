/**
 * Harvest outbound authority URLs from low-authority discovery candidates.
 *
 * Community/RSS sources often cite primary archives (NPS, NMAAHC, LOC, etc.). Those URLs are
 * follow-up evidence leads — the blog is a discovery index, not a fact source. Full article
 * bodies are never stored; callers may pass ephemeral HTML/text for richer extraction.
 */
import { isLowAuthoritySourceTier } from '../relevance/gates.js';
import type { AuthorityFollowUpLead, DiscoveryCandidateRecord } from './types.js';

export type { AuthorityFollowUpLead };

/** Curated HTTPS hosts that map to authority-control / primary archival surfaces. */
export const AUTHORITY_HOST_SUFFIXES = [
  'nps.gov',
  'nmaahc.si.edu',
  'si.edu',
  'loc.gov',
  'archives.gov',
  'wikidata.org',
  'wikipedia.org',
  'congress.gov',
  'federalregister.gov',
  'govinfo.gov',
  'dp.la',
  'europeana.eu',
  'viaf.org',
  'worldcat.org',
  'snaccooperative.org',
] as const;

export type AuthorityHostSuffix = (typeof AUTHORITY_HOST_SUFFIXES)[number];

export type HarvestAuthorityFollowUpsInput = {
  readonly candidate: DiscoveryCandidateRecord;
  readonly harvestedAt: string;
  /**
   * Ephemeral HTML or plain text (e.g. feed content:encoded or a fetched page). Not persisted
   * on the candidate — used only for href extraction in this call.
   */
  readonly sourceText?: string;
  /** Extra pre-extracted URLs (e.g. RSS outboundLinkHints). */
  readonly linkHints?: readonly string[];
};

const HREF_RE = /\bhref\s*=\s*["']([^"']+)["']/gi;
const BARE_URL_RE = /https:\/\/[^\s<>"')\]]+/gi;
const MAX_LEADS_PER_CANDIDATE = 25;

function hostnameOf(url: URL): string {
  return url.hostname.replace(/^www\./i, '').toLowerCase();
}

export function isAuthorityHost(hostname: string): boolean {
  const host = hostname.replace(/^www\./i, '').toLowerCase();
  return AUTHORITY_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

/**
 * Normalize to https URL, drop fragments and common tracking params, reject non-http(s).
 * Returns undefined when the URL is unusable or not on the authority allowlist.
 */
export function normalizeAuthorityUrl(
  raw: string,
): { readonly url: string; readonly host: string } | undefined {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return undefined;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return undefined;
  }
  // Prefer https for follow-up intake (SSRF-safe fetch path requires https in many gates).
  if (parsed.protocol === 'http:') {
    parsed.protocol = 'https:';
  }
  const host = hostnameOf(parsed);
  if (!isAuthorityHost(host)) {
    return undefined;
  }
  parsed.hash = '';
  for (const key of [...parsed.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid|mc_)/i.test(key)) {
      parsed.searchParams.delete(key);
    }
  }
  return { url: parsed.toString(), host };
}

function extractRawUrls(text: string): readonly string[] {
  const found: string[] = [];
  for (const match of text.matchAll(HREF_RE)) {
    if (match[1]) found.push(match[1]);
  }
  for (const match of text.matchAll(BARE_URL_RE)) {
    found.push(match[0].replace(/[.,;:]+$/u, ''));
  }
  return found;
}

function payloadLinkHints(candidate: DiscoveryCandidateRecord): readonly string[] {
  const payload = candidate.adapterRecord.payload;
  const hints = payload?.outboundLinkHints;
  if (!Array.isArray(hints)) return [];
  return hints.filter((item): item is string => typeof item === 'string');
}

function selfHost(candidate: DiscoveryCandidateRecord): string | undefined {
  const canonical = candidate.adapterRecord.canonicalUrl;
  if (!canonical) return undefined;
  try {
    return hostnameOf(new URL(canonical));
  } catch {
    return undefined;
  }
}

/**
 * Extract authority follow-up leads from a single candidate.
 * Returns [] when the candidate is not low-authority (primary archival sources are already
 * first-class adapters — do not fan them back out as "follow-ups").
 */
export function harvestAuthorityFollowUpsForCandidate(
  input: HarvestAuthorityFollowUpsInput,
): readonly AuthorityFollowUpLead[] {
  const classification = input.candidate.adapterRecord.classification;
  if (!isLowAuthoritySourceTier(classification)) {
    return [];
  }

  const summary =
    typeof input.candidate.adapterRecord.payload?.summary === 'string'
      ? input.candidate.adapterRecord.payload.summary
      : '';
  const textParts = [
    input.candidate.adapterRecord.title ?? '',
    summary,
    input.sourceText ?? '',
  ];
  const rawUrls = [
    ...payloadLinkHints(input.candidate),
    ...(input.linkHints ?? []),
    ...extractRawUrls(textParts.join('\n')),
  ];

  const parentHost = selfHost(input.candidate);
  const seen = new Set<string>();
  const leads: AuthorityFollowUpLead[] = [];

  for (const raw of rawUrls) {
    if (leads.length >= MAX_LEADS_PER_CANDIDATE) break;
    const normalized = normalizeAuthorityUrl(raw);
    if (!normalized) continue;
    if (parentHost && normalized.host === parentHost) continue;
    if (seen.has(normalized.url)) continue;
    seen.add(normalized.url);

    leads.push({
      url: normalized.url,
      host: normalized.host,
      parentCandidateId: input.candidate.id,
      parentStableIdentifier: input.candidate.identity.stableIdentifier,
      ...(input.candidate.adapterRecord.canonicalUrl !== undefined
        ? { parentCanonicalUrl: input.candidate.adapterRecord.canonicalUrl }
        : {}),
      ...(classification !== undefined ? { sourceClassification: classification } : {}),
      reason: 'authority_host_allowlist',
      harvestedAt: input.harvestedAt,
    });
  }

  return leads;
}

export type HarvestAuthorityFollowUpsBatchInput = {
  readonly candidates: readonly DiscoveryCandidateRecord[];
  readonly harvestedAt: string;
  /** Optional ephemeral HTML/text keyed by discovery candidate id. */
  readonly sourceTextByCandidateId?: ReadonlyMap<string, string>;
};

/** Harvest authority follow-ups across a campaign survivor set. */
export function harvestAuthorityFollowUpsForCandidates(
  input: HarvestAuthorityFollowUpsBatchInput,
): readonly AuthorityFollowUpLead[] {
  const leads: AuthorityFollowUpLead[] = [];
  for (const candidate of input.candidates) {
    if (candidate.status !== 'accepted' && candidate.status !== 'merged') {
      continue;
    }
    const sourceText = input.sourceTextByCandidateId?.get(candidate.id);
    leads.push(
      ...harvestAuthorityFollowUpsForCandidate({
        candidate,
        harvestedAt: input.harvestedAt,
        ...(sourceText !== undefined ? { sourceText } : {}),
      }),
    );
  }
  return leads;
}
