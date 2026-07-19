/**
 * Enrichment runner: editorial judge focused on filling missing prose/fields and
 * related-entity suggestions for already-kept subjects. Same staging boundary as editorial-run.
 */
import type { EditorialRunInput, EditorialRunResult } from './editorial-run.js';
import { runEditorialJudge } from './editorial-run.js';

export type EnrichmentRunInput = EditorialRunInput;

export type EnrichmentRunResult = Omit<EditorialRunResult, 'kind'> & {
  readonly kind: 'enrichment.run.v1';
};

/** Enrichment is editorial-run with a distinct result kind for operator/session routing. */
export async function runEnrichmentJudge(input: EnrichmentRunInput): Promise<EnrichmentRunResult> {
  const result = await runEditorialJudge(input);
  return {
    ...result,
    kind: 'enrichment.run.v1',
  };
}
