/**
 * Shared evidence fetch and subject assembly for provider and externally supplied drafts. Both
 * are validated against the same captured inputs.
 */
import type pg from 'pg';
import { createHash } from 'node:crypto';
import type { EnrichmentSubject } from './entity-enrichment-llm.ts';
import { type EvidenceExcerpt, excerptForWindow } from './evidence-excerpt.ts';

/** Per-source cap so one huge nomination form does not crowd out every other source. */
export const MAX_CHARS_PER_SOURCE = 4_000;

/**
 * Allocates larger excerpt windows to long primary nomination documents. Window size alone does
 * not establish completeness; retain truncation and excerpt-selection metadata.
 */
export const MAX_CHARS_PER_TIER1_SOURCE = 12_000;

/** Total evidence chars offered to the model, across all sources for one entity. */
export const MAX_TOTAL_EVIDENCE_CHARS = 20_000;

/**
 * Floor held back for each source still waiting behind the current one.
 *
 * Without it the tier-1 window silently becomes a source-count reduction: two nomination-tier
 * documents at 12,000 each consume the entire budget, every remaining source is handed zero
 * characters and is dropped, and the record loses the independent corroboration that
 * `researchCoverage` counts and that `minClaimConfidence` needs to clear the publish floor. More
 * text from one source is not worth fewer sources — that trade is the opposite of the point.
 */
export const MIN_CHARS_RESERVED_PER_REMAINING_SOURCE = 1_200;

type CandidateRow = {
  readonly id: string;
  readonly lane: string | null;
  readonly display_name: string;
  readonly payload: {
    readonly kind?: string;
    readonly restrictedAddress?: boolean;
  };
};

type EvidenceRow = {
  readonly entity_id: string;
  readonly id: string;
  readonly source_tier: 'tier1' | 'tier2' | 'lead';
  readonly title: string | null;
  readonly content_text: string | null;
  readonly content_hash: string | null;
};

/** Minimal query surface this module needs — satisfied by `pg.Pool` and `pg.PoolClient`. */
export type QueryablePool = Pick<pg.Pool, 'query'>;

/**
 * Turns an excerpt's shape into the one line of prose the drafter sees beside the text.
 *
 * The `laneTermScore === 0` case is the one that changes an outcome. A drafter handed a truncated
 * document cannot tell "the history is past the window" from "there is no history here", and the
 * two call for opposite actions — defer, or refuse. Only the excerpter, which scanned the WHOLE
 * document, can tell them apart, so it says which.
 */
export function readNoteFor(excerpt: EvidenceExcerpt): string | null {
  if (excerpt.complete) return null;
  const scale = `${excerpt.omittedChars.toLocaleString('en-US')} characters of this document are not shown`;
  if (excerpt.laneTermScore === 0) {
    return (
      `${scale}. Nothing anywhere in the full document mentions Black history — not the omitted ` +
      'part either, which was scanned in full. This is an absence, not a truncation.'
    );
  }
  return (
    `${scale}. This is not the opening of the document: it is the document's own opening ` +
    'statement followed by the passages that discuss Black history, selected from the whole ' +
    'document and shown in order. "[…]" marks each gap.'
  );
}

/**
 * Exported for tests. The budget arithmetic decides what a drafter actually reads, and it is the
 * kind of code where an off-by-one silently costs a whole source rather than throwing.
 */
export function selectEvidenceForModel(
  rows: readonly EvidenceRow[],
): EnrichmentSubject['evidence'] {
  const usable = rows.filter((row) => row.content_text !== null && row.content_text.length > 0);
  // Prefer tier1 evidence, then longer text, matching the acquisition pipeline's ordering.
  const ordered = [...usable].sort((a, b) => {
    if (a.source_tier !== b.source_tier) return a.source_tier === 'tier1' ? -1 : 1;
    return (b.content_text?.length ?? 0) - (a.content_text?.length ?? 0);
  });
  const evidence: EnrichmentSubject['evidence'][number][] = [];
  let budget = MAX_TOTAL_EVIDENCE_CHARS;
  for (const [index, row] of ordered.entries()) {
    if (budget <= 0) break;
    const perSourceCap =
      row.source_tier === 'tier1' ? MAX_CHARS_PER_TIER1_SOURCE : MAX_CHARS_PER_SOURCE;
    // Keep a slice for each source still queued behind this one, so a long tier-1 document cannot
    // crowd the others out of the bundle entirely.
    // With many sources the reserve can exceed the whole budget, so this source always keeps at
    // least the floor itself — otherwise a 20-source entity reserves everything for everyone,
    // hands the first source zero characters, and drops every source in the bundle.
    const reserved = (ordered.length - index - 1) * MIN_CHARS_RESERVED_PER_REMAINING_SOURCE;
    const available = Math.min(
      budget,
      Math.max(budget - reserved, MIN_CHARS_RESERVED_PER_REMAINING_SOURCE),
    );
    // Select relevant passages rather than only the document head, which may contain forms and
    // building inventories instead of historical context.
    const excerpt = excerptForWindow(row.content_text ?? '', Math.min(perSourceCap, available));
    const text = excerpt.text;
    if (text.length === 0) continue;
    evidence.push({
      id: row.id,
      sourceTier: row.source_tier as 'tier1' | 'tier2',
      title: row.title,
      text,
      readNote: readNoteFor(excerpt),
    });
    budget -= text.length;
  }
  return evidence;
}

/** Same digest formula used by sweep-entity-evidence.ts, so unchanged evidence compares equally. */
export function evidenceDigestFor(
  rows: readonly { readonly content_hash: string | null }[],
): string | null {
  const hashes = rows
    .map((row) => row.content_hash)
    .filter((hash): hash is string => hash !== null);
  if (hashes.length === 0) return null;
  return createHash('sha256')
    .update([...hashes].sort().join('|'))
    .digest('hex');
}

export type FetchedSubject = EnrichmentSubject & { readonly evidenceDigest: string | null };

export type FetchEnrichmentSubjectsResult = {
  readonly subjects: readonly FetchedSubject[];
  /** entity_id has no captured evidence row, or no landscape_candidates row at all. */
  readonly skippedNoEvidence: readonly string[];
};

/**
 * Given a list of entity ids, fetches display name/kind/restrictedAddress and captured evidence
 * for each and assembles the exact `EnrichmentSubject` a model prompt is built from. Entities with
 * no usable evidence (or no landscape_candidates row) are reported separately, never silently
 * dropped.
 */
export async function fetchEnrichmentSubjects(
  pool: QueryablePool,
  entityIds: readonly string[],
): Promise<FetchEnrichmentSubjectsResult> {
  if (entityIds.length === 0) return { subjects: [], skippedNoEvidence: [] };

  const candidateRows = await pool.query<CandidateRow>(
    `SELECT id, lane, display_name, payload
       FROM research.landscape_candidates
      WHERE id = ANY($1::text[])`,
    [entityIds],
  );
  const candidateById = new Map(candidateRows.rows.map((row) => [row.id, row]));

  const evidenceRows = await pool.query<EvidenceRow>(
    `SELECT entity_id, id, source_tier, title, content_text, content_hash
       FROM research.entity_evidence
      WHERE entity_id = ANY($1::text[]) AND status = 'captured'`,
    [entityIds],
  );
  const evidenceByEntity = new Map<string, EvidenceRow[]>();
  for (const row of evidenceRows.rows) {
    const list = evidenceByEntity.get(row.entity_id) ?? [];
    list.push(row);
    evidenceByEntity.set(row.entity_id, list);
  }

  const subjects: FetchedSubject[] = [];
  const skippedNoEvidence: string[] = [];
  for (const entityId of entityIds) {
    const candidate = candidateById.get(entityId);
    const evidenceRowsForEntity = evidenceByEntity.get(entityId) ?? [];
    const evidence = selectEvidenceForModel(evidenceRowsForEntity);
    if (evidence.length === 0 || candidate === undefined) {
      skippedNoEvidence.push(entityId);
      continue;
    }
    subjects.push({
      entityId,
      displayName: candidate.display_name,
      kind: candidate.payload.kind,
      lane: candidate.lane ?? '',
      restrictedAddress: candidate.payload.restrictedAddress === true,
      evidence,
      evidenceDigest: evidenceDigestFor(evidenceRowsForEntity),
    });
  }
  return { subjects, skippedNoEvidence };
}
