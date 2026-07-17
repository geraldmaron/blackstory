/**
 * Search index construction with defense-in-depth notability-gate enforcement.
 *
 * requires that every published search result carries at least one `notabilityBasis` 
 * "the inclusion gate holds AT THE SEARCH BOUNDARY." The publication-side call site that should
 * enforce this (`packages/domain/src/publication/`) does not yet call the gate (see the wiring note
 * in `../relevance/notability-gate.ts`). So this builder independently enforces it as
 * defense-in-depth: regardless of whether the publication-side gap is ever closed, no entity
 * lacking a notability basis can enter the search index.
 *
 * A failing entity does NOT abort the whole batch that would let one bad record take down an
 * entire index build. Instead the entity is SKIPPED and reported in a separate `skipped` list with
 * the gate's reason, so the rest of the release still indexes.
 */
import { evaluateNotabilityGate } from '../relevance/notability-gate.js';
import type { PublicSearchIndexDoc, SearchableEntityRecord } from './types.js';

export type SkippedRecord = {
  readonly id: string;
  readonly reason: string;
};

export type BuildSearchIndexResult = {
  readonly docs: readonly PublicSearchIndexDoc[];
  readonly skipped: readonly SkippedRecord[];
};

/**
 * Builds the persisted search index docs for a release. Every record is run through the
 * notability-basis gate; records that fail are skipped (not indexed) and returned in `skipped`
 * with the gate reason. Never throws on a bad record.
 */
export function buildPublicSearchIndexDocs(
  releaseId: string,
  records: readonly SearchableEntityRecord[],
): BuildSearchIndexResult {
  const docs: PublicSearchIndexDoc[] = [];
  const skipped: SkippedRecord[] = [];

  for (const record of records) {
    const gate = evaluateNotabilityGate(record.notabilityBasis);
    if (!gate.passed) {
      skipped.push({ id: record.id, reason: gate.reason });
      continue;
    }
    docs.push({ ...record, releaseId });
  }

  return { docs, skipped };
}
