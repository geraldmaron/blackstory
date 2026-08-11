/**
 * repo-n7p6.4 (WS4) — shared DB fetch + subject assembly for every WS4 entry point
 * (enrich-entities-llm.ts calling OpenRouter, session-enrich-prepare.ts for a session/Haiku-
 * driven pass). One place decides what evidence a model sees for a given entity id, so an
 * OpenRouter-drafted answer and a session-drafted answer are judged by
 * validateEnrichmentResponse against exactly the same input — nothing about the trust model
 * changes with who answers.
 */
import type pg from 'pg';
import { createHash } from 'node:crypto';
import type { EnrichmentSubject } from './entity-enrichment-llm.ts';

/** Per-source cap so one huge nomination form does not crowd out every other source. */
export const MAX_CHARS_PER_SOURCE = 4_000;

/**
 * Tier-1 sources get a bigger window. A National Register nomination is the deepest source in the
 * corpus and the only one that carries a statement of significance; a Wikipedia stub is not
 * competing for the same space.
 *
 * Sized from the corpus rather than picked: the median captured nomination runs about 23,000
 * characters, of which the significance statement is a large share. 4,000 was leaving a median of
 * 18,893 characters unread (repo-de8i), and while ordering significance first means the window now
 * lands on the history rather than the cornice profiles, a 4,000-character view of a 23,000
 * character document still stops mid-argument.
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
 * Exported for tests. The budget arithmetic decides what a drafter actually reads, and it is the
 * kind of code where an off-by-one silently costs a whole source rather than throwing.
 */
export function selectEvidenceForModel(
  rows: readonly EvidenceRow[],
): EnrichmentSubject['evidence'] {
  const usable = rows.filter((row) => row.content_text !== null && row.content_text.length > 0);
  // tier1 first (richest, most authoritative), then by length — matches WS3's own preference.
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
    const text = (row.content_text ?? '').slice(0, Math.min(perSourceCap, available));
    if (text.length === 0) continue;
    evidence.push({
      id: row.id,
      sourceTier: row.source_tier as 'tier1' | 'tier2',
      title: row.title,
      text,
    });
    budget -= text.length;
  }
  return evidence;
}

/** Same digest formula sweep-entity-evidence.ts uses, so "unchanged since WS3" is comparable. */
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
       FROM bb_research.landscape_candidates
      WHERE id = ANY($1::text[])`,
    [entityIds],
  );
  const candidateById = new Map(candidateRows.rows.map((row) => [row.id, row]));

  const evidenceRows = await pool.query<EvidenceRow>(
    `SELECT entity_id, id, source_tier, title, content_text, content_hash
       FROM bb_research.entity_evidence
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
