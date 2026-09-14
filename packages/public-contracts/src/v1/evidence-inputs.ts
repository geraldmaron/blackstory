/**
 * Evidence INPUTS on the wire — the facts a grade is computed from, never the grade.
 *
 * `apps/web/src/lib/records/build-records-index.ts` states the rule this schema exists to serve:
 * THE TIER IS NEVER READ OUT OF THE INDEX. A surface that is handed a letter has been handed a
 * conclusion someone else reached, possibly under a rule that has since changed — that is exactly
 * how `/records` kept grading records by the old rule for a day after the corroboration rule
 * moved. So a payload carries `strongestClaimLevel`, `citedLineageKeys` and `evidenceLineageKeys`
 * — all facts read straight off the claim rows — and every reader ends at
 * `confidenceTierFromEvidenceInputs` in `../evidence.ts`, which is the one place the rule lives.
 *
 * This mirrors `recordEvidenceInputsSchema` in `@repo/schemas` (the storage-side shape stored on
 * `search_index.facets`). It is restated here rather than imported because this package's
 * boundary allows zod and nothing else, and because a wire contract pins its own bounds: the
 * lineage arrays are capped so a hostile response cannot force an unbounded allocation.
 */
import { z } from 'zod';
import { boundedArray, nonEmptyText } from '../internal/primitives.js';
// `unrated` is unassessed, never a fourth grade — the one tier vocabulary, defined once.
import { confidenceTierSchema } from './map.js';

/** Bound on distinct citation lineages carried for one record. */
export const MAX_EVIDENCE_LINEAGE_KEYS = 200;

export const evidenceInputsV1Schema = z.object({
  strongestClaimLevel: confidenceTierSchema,
  citedLineageKeys: boundedArray(nonEmptyText(200), MAX_EVIDENCE_LINEAGE_KEYS),
  evidenceLineageKeys: boundedArray(nonEmptyText(200), MAX_EVIDENCE_LINEAGE_KEYS),
});

export type EvidenceInputsV1 = z.infer<typeof evidenceInputsV1Schema>;
