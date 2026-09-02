/**
 * Resolve Internet Archive and Wayback URLs from public claim citations for reader surfaces.
 */
import type { PublicClaimView } from '../../data/public-seed';

export type InternetArchiveSourceKind = 'details' | 'wayback';

export type InternetArchiveSource = {
  readonly id: string;
  readonly kind: InternetArchiveSourceKind;
  readonly title: string;
  readonly href: string;
  readonly claimId: string;
  readonly identifier?: string;
  readonly originalUrl?: string;
};

type ParsedArchiveUrl =
  | { readonly kind: 'details'; readonly identifier: string; readonly href: string }
  | { readonly kind: 'wayback'; readonly href: string; readonly originalUrl?: string };

const DETAILS_RE = /^https?:\/\/(?:web\.)?archive\.org\/details\/([^/?#]+)/iu;
const WAYBACK_RE = /^https?:\/\/web\.archive\.org\/web\/\d+\/(.+)/iu;

export function parseInternetArchiveUrl(url: string): ParsedArchiveUrl | undefined {
  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const detailsMatch = DETAILS_RE.exec(trimmed);
  if (detailsMatch?.[1]) {
    const identifier = decodeURIComponent(detailsMatch[1]);
    return {
      kind: 'details',
      identifier,
      href: `https://archive.org/details/${encodeURIComponent(identifier)}`,
    };
  }

  const waybackMatch = WAYBACK_RE.exec(trimmed);
  if (waybackMatch) {
    let originalUrl: string | undefined;
    try {
      originalUrl = decodeURIComponent(waybackMatch[1] ?? '');
    } catch {
      originalUrl = waybackMatch[1];
    }
    if (originalUrl !== undefined && originalUrl.length === 0) {
      originalUrl = undefined;
    }
    return {
      kind: 'wayback',
      href: trimmed,
      ...(originalUrl !== undefined ? { originalUrl } : {}),
    };
  }

  return undefined;
}

function titleForClaim(
  claim: Pick<PublicClaimView, 'citationLabel' | 'citationSource' | 'object'>,
  parsed: ParsedArchiveUrl,
): string {
  const label = claim.citationLabel.trim();
  if (label.length > 0 && !/^https?:\/\//iu.test(label)) {
    return label;
  }
  if (parsed.kind === 'details') {
    return parsed.identifier.replace(/[-_]+/g, ' ');
  }
  if (parsed.originalUrl) {
    try {
      return new URL(parsed.originalUrl).hostname.replace(/^www\./iu, '');
    } catch {
      return parsed.originalUrl;
    }
  }
  return claim.citationSource.trim() || 'Archived capture';
}

/** Collect distinct IA-backed sources from claim citation links. */
export function resolveInternetArchiveSources(
  claims: readonly Pick<
    PublicClaimView,
    'id' | 'citationHref' | 'citationLabel' | 'citationSource' | 'object'
  >[],
): readonly InternetArchiveSource[] {
  const seen = new Set<string>();
  const sources: InternetArchiveSource[] = [];

  for (const claim of claims) {
    const href = claim.citationHref?.trim();
    if (!href) {
      continue;
    }
    const parsed = parseInternetArchiveUrl(href);
    if (!parsed) {
      continue;
    }
    const dedupeKey = parsed.kind === 'details' ? `details:${parsed.identifier}` : parsed.href;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);

    sources.push({
      id: `${claim.id}:${dedupeKey}`,
      kind: parsed.kind,
      title: titleForClaim(claim, parsed),
      href: parsed.href,
      claimId: claim.id,
      ...(parsed.kind === 'details' ? { identifier: parsed.identifier } : {}),
      ...(parsed.kind === 'wayback' && parsed.originalUrl !== undefined
        ? { originalUrl: parsed.originalUrl }
        : {}),
    });
  }

  return sources;
}
