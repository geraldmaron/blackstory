/**
 * Search-index adapter hook: published `FactRecord`s -> the search lane (
 * ).
 *
 * Produces docs that are STRUCTURALLY `PublicSearchIndexDoc` (`../search/types.ts`) — the exact
 * shape `rankRecords`/`applyFilters`/`computeFacetCounts`/`runPublicSearch` already consume so
 * a fact-search page can call the real pipeline functions directly, and a future combined
 * index can concatenate `[...entityDocs,...factDocs]` into one `PublicSearchIndexDoc` without
 * a shape mismatch.
 *
 * Deliberately DOES NOT reuse `../search/index-build.ts`'s `buildPublicSearchIndexDocs`: that
 * function enforces the entity `notabilityBasis` gate
 * (`../relevance/notability-gate.ts`), whose closed criterion vocabulary
 * (first_to_do_x/major_honor_or_hall_of_fame/…) describes why an ENTITY belongs in the registry
 * and does not describe a fact. Facts have their own, already-appropriate fail-closed gate the
 * citation-completeness publish gate (`./publish-gate.ts`) so this module's `notabilityBasis`
 * field is always `` (structurally valid, semantically "not applicable") and indexability is
 * governed by `isFactSearchIndexable` + the publish gate instead.
 */
import { deriveEraBuckets } from '../era.js';
import type { PublicSearchIndexDoc, SearchableEntityRecord } from '../search/types.js';
import { evaluateFactPublishGate } from './publish-gate.js';
import { isFactSearchIndexable } from './publish-gate.js';
import type { FactRecord } from './record.js';

export type FactSearchIndexDoc = PublicSearchIndexDoc;

export type SkippedFactRecord = {
  readonly id: string;
  readonly reason: string;
};

export type BuildFactSearchIndexResult = {
  readonly docs: readonly FactSearchIndexDoc[];
  readonly skipped: readonly SkippedFactRecord[];
};

/**
 * Maps `FactConfidenceGrade` -> the `researchCoverage` union. `established`/`corroborated`
 * (independently-checked evidence) count as `substantial`; `single-source` as `partial`;
 * `contested` as `minimal` a deterministic, documented mapping, not a hidden score.
 */
function researchCoverageFromConfidence(
  confidence: FactRecord['confidence'],
): SearchableEntityRecord['researchCoverage'] {
  switch (confidence) {
    case 'established':
    case 'corroborated':
      return 'substantial';
    case 'single-source':
      return 'partial';
    case 'contested':
    default:
      return 'minimal';
  }
}

function nameVariantAliases(fact: FactRecord): readonly string[] {
  return fact.qualifiers
    .filter((qualifier) => qualifier.kind === 'name-variant')
    .map((qualifier) => qualifier.value.toLowerCase());
}

/**
 * Builds one fact's searchable doc. Returns `undefined` (never throws) when the fact is not
 * currently indexable the caller (`buildFactSearchIndexDocs`) reports the reason in `skipped`
 * so a bad/incomplete record never aborts the whole index build, mirroring
 * `../search/index-build.ts`'s skip-not-abort posture.
 */
export function buildFactSearchIndexDoc(
  fact: FactRecord,
  releaseId: string,
): FactSearchIndexDoc | { readonly skipped: SkippedFactRecord } {
  if (!isFactSearchIndexable(fact)) {
    return { skipped: { id: fact.id, reason: `status "${fact.status}" is not search-indexable` } };
  }
  const gate = evaluateFactPublishGate(fact);
  if (!gate.ok) {
    return { skipped: { id: fact.id, reason: gate.message } };
  }

  const record: SearchableEntityRecord = {
    id: fact.id,
    kind: 'fact',
    displayName: fact.shortStatement,
    nameLower: fact.shortStatement.toLowerCase(),
    aliases: nameVariantAliases(fact),
    summary: fact.statement,
    topicTags: [fact.claimType],
    status: fact.status,
    eraBuckets: fact.when ? deriveEraBuckets(fact.when) : [],
    // Facts are gated by./publish-gate.ts's citation-completeness check, not the entity
    // notability rubric see this module's doc comment.
    notabilityBasis: [],
    notabilityLabels: [],
    recordMaturity: fact.status,
    researchCoverage: researchCoverageFromConfidence(fact.confidence),
    relatedCount: fact.subjects.length,
    claimCount: fact.citations.length,
  };

  return { ...record, releaseId };
}

/**
 * Builds the persisted fact-search-index docs for a release, skipping (never aborting on) any
 * fact that is not currently indexable or fails the publish gate.
 */
export function buildFactSearchIndexDocs(
  releaseId: string,
  facts: readonly FactRecord[],
): BuildFactSearchIndexResult {
  const docs: FactSearchIndexDoc[] = [];
  const skipped: SkippedFactRecord[] = [];

  for (const fact of facts) {
    const result = buildFactSearchIndexDoc(fact, releaseId);
    if ('skipped' in result) {
      skipped.push(result.skipped);
    } else {
      docs.push(result);
    }
  }

  return { docs, skipped };
}
