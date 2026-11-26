/**
 * Merge reviewed citations into a landscape candidate's `evidenceCitations`.
 *
 * A record that is already accepted or live still gains evidence: a second publisher found
 * after publication, a dead link replaced, a passage a reader should see. The cohort stagers
 * only rewrite the rows their data files own, and nothing else appended to a landscape row, so
 * that evidence had no path to the publisher. This is the pure half of that path; the script
 * `stage-landscape-evidence.ts` applies it.
 *
 * Dedupe is by DOCUMENT and passage, the same granularity the publisher uses: a second quote
 * from a document already cited is kept (the publisher merges it into that document's claim),
 * an identical passage is dropped, and a quote from a document not yet cited is appended. The
 * merge never removes or reorders what is already there, so a reviewer's diff is additions only.
 */

import { PUBLIC_PRECISION_TIERS, isPublicPrecisionTier } from '@repo/domain';

export type EvidenceCitation = {
  readonly sourceUrl: string;
  readonly title: string;
  readonly quote: string;
};

export type EvidenceMergeResult = {
  readonly citations: readonly EvidenceCitation[];
  readonly added: readonly EvidenceCitation[];
  readonly skipped: readonly { readonly citation: EvidenceCitation; readonly reason: string }[];
};

/**
 * Document identity for dedupe: host without `www.`, path without a trailing slash, query kept.
 * Mirrors the publisher's document key so a citation this merge treats as new is one the
 * publisher will also treat as a new document.
 */
export function evidenceDocumentKey(url: string): string | null {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/$/u, '');
    return `${parsed.hostname.replace(/^www\./iu, '').toLowerCase()}${path}${parsed.search}`;
  } catch {
    return null;
  }
}

function normalizePassage(text: string): string {
  return text.trim().replace(/\s+/gu, ' ').replace(/\.$/u, '').toLowerCase();
}

function asCitation(value: unknown): EvidenceCitation | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const sourceUrl = typeof record.sourceUrl === 'string' ? record.sourceUrl.trim() : '';
  const title = typeof record.title === 'string' ? record.title.trim() : '';
  const quote = typeof record.quote === 'string' ? record.quote.trim() : '';
  if (sourceUrl.length === 0 || quote.length === 0) return null;
  return { sourceUrl, title: title.length > 0 ? title : sourceUrl, quote };
}

export function mergeEvidenceCitations(
  existing: readonly unknown[],
  incoming: readonly unknown[],
): EvidenceMergeResult {
  const citations: EvidenceCitation[] = [];
  const seen = new Set<string>();
  for (const raw of existing) {
    const citation = asCitation(raw);
    if (!citation) continue;
    citations.push(citation);
    const key = evidenceDocumentKey(citation.sourceUrl);
    if (key !== null) seen.add(`${key}|${normalizePassage(citation.quote)}`);
  }

  const added: EvidenceCitation[] = [];
  const skipped: { citation: EvidenceCitation; reason: string }[] = [];
  for (const raw of incoming) {
    const citation = asCitation(raw);
    if (!citation) {
      skipped.push({
        citation: {
          sourceUrl: String((raw as { sourceUrl?: unknown })?.sourceUrl ?? ''),
          title: '',
          quote: '',
        },
        reason: 'missing sourceUrl or quote',
      });
      continue;
    }
    if (!citation.sourceUrl.startsWith('https://')) {
      skipped.push({ citation, reason: 'sourceUrl is not https' });
      continue;
    }
    const key = evidenceDocumentKey(citation.sourceUrl);
    if (key === null) {
      skipped.push({ citation, reason: 'sourceUrl is not a URL' });
      continue;
    }
    const passageKey = `${key}|${normalizePassage(citation.quote)}`;
    if (seen.has(passageKey)) {
      skipped.push({ citation, reason: 'identical passage already cited' });
      continue;
    }
    seen.add(passageKey);
    citations.push(citation);
    added.push(citation);
  }
  return { citations, added, skipped };
}

/**
 * Apply exact-substring prose corrections to a stored text. A `current` that does not occur
 * exactly once is refused: zero matches means the text moved since the reviewer read it, more
 * than one means the correction is ambiguous. Either way the text is left alone and the reason
 * returned, so a stale correction never lands on the wrong sentence.
 */
export function applyProseCorrections(
  text: string,
  corrections: readonly { readonly current: string; readonly suggested: string }[],
): { readonly text: string; readonly applied: number; readonly refused: readonly string[] } {
  let out = text;
  let applied = 0;
  const refused: string[] = [];
  for (const correction of corrections) {
    const occurrences = out.split(correction.current).length - 1;
    if (occurrences !== 1) {
      refused.push(
        `${occurrences === 0 ? 'not found' : 'ambiguous'}: ${correction.current.slice(0, 80)}`,
      );
      continue;
    }
    out = out.replace(correction.current, correction.suggested);
    applied += 1;
  }
  return { text: out, applied, refused };
}

export type StagedLocation = {
  readonly lat: number;
  readonly lng: number;
  readonly precision: string;
  readonly city?: string;
  readonly state?: string;
  readonly sourceUrl: string;
  readonly quote?: string;
  readonly matchMethod?: string;
};

/**
 * Validate a sourced location before it is staged onto a candidate that has none. New records
 * cannot publish without coordinates, and nothing else stages them for researched rows. The
 * precision must already be a controlled public tier (no silent normalization: a researcher who
 * wrote "street" should be told, not quietly given "address"), and the source must be an https
 * page so the point can be traced.
 */
export function parseStagedLocation(
  raw: unknown,
):
  | { readonly ok: true; readonly location: StagedLocation }
  | { readonly ok: false; readonly reason: string } {
  if (typeof raw !== 'object' || raw === null)
    return { ok: false, reason: 'location is not an object' };
  const value = raw as Record<string, unknown>;
  const { lat, lng, precision, sourceUrl } = value;
  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { ok: false, reason: 'lat must be a number between -90 and 90' };
  }
  if (typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return { ok: false, reason: 'lng must be a number between -180 and 180' };
  }
  if (typeof precision !== 'string' || !isPublicPrecisionTier(precision)) {
    return { ok: false, reason: `precision must be one of ${PUBLIC_PRECISION_TIERS.join(', ')}` };
  }
  if (typeof sourceUrl !== 'string' || !/^https:\/\/[^\s/]+\.[^\s]+$/u.test(sourceUrl)) {
    return { ok: false, reason: 'sourceUrl must be an https URL' };
  }
  const text = (key: string): string | undefined =>
    typeof value[key] === 'string' && (value[key] as string).trim().length > 0
      ? (value[key] as string).trim()
      : undefined;
  const city = text('city');
  const state = text('state');
  const quote = text('quote');
  const matchMethod = text('matchMethod');
  return {
    ok: true,
    location: {
      lat,
      lng,
      precision,
      sourceUrl,
      ...(city === undefined ? {} : { city }),
      ...(state === undefined ? {} : { state }),
      ...(quote === undefined ? {} : { quote }),
      ...(matchMethod === undefined ? {} : { matchMethod }),
    },
  };
}
