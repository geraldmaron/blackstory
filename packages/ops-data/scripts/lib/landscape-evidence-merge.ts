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
