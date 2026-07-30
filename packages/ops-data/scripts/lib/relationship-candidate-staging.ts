/**
 * Shape ranked relationship candidates into bb_research.landscape_candidates rows.
 * Candidate generator only — never writes bb_canonical.entity_relationships.
 */
import type { RankedRelationshipCandidate } from './relationship-candidate-ranking.ts';

export const RELATIONSHIP_INFERENCE_LANE = 'relationship-inference' as const;
export const RELATIONSHIP_INFERENCE_PROGRAM_ID = 'spatiotemporal-relationship-inference' as const;

export type RelationshipLandscapeRow = {
  readonly id: string;
  readonly run_id: string;
  readonly lane: typeof RELATIONSHIP_INFERENCE_LANE;
  readonly source_program_id: string;
  readonly source_item_id: string;
  readonly display_name: string;
  readonly kind: string;
  readonly summary: string;
  readonly canonical_url: string;
  readonly status: 'pending';
  readonly provenance: {
    readonly from_entity_id: string;
    readonly to_entity_id: string;
    readonly tier: RankedRelationshipCandidate['tier'];
    readonly score_signals: readonly string[];
  };
  readonly payload: {
    readonly from_entity_id: string;
    readonly to_entity_id: string;
    readonly relationship_type: RankedRelationshipCandidate['suggestedType'];
    readonly primary_reason: RankedRelationshipCandidate['primaryReason'];
    readonly score: number;
    readonly score_components: Readonly<Record<string, number>>;
    readonly tier: RankedRelationshipCandidate['tier'];
  };
  readonly discovered_at: string;
};

function sourceItemId(candidate: RankedRelationshipCandidate): string {
  return `${candidate.fromEntityId}|${candidate.toEntityId}|${candidate.suggestedType}`;
}

export function shapeRelationshipLandscapeRows(
  candidates: readonly RankedRelationshipCandidate[],
  runId: string,
  entityNamesById: ReadonlyMap<string, string>,
  nowIso: string = new Date().toISOString(),
): readonly RelationshipLandscapeRow[] {
  return candidates.map((candidate) => {
    const fromName = entityNamesById.get(candidate.fromEntityId) ?? candidate.fromEntityId;
    const toName = entityNamesById.get(candidate.toEntityId) ?? candidate.toEntityId;
    const sourceItemIdValue = sourceItemId(candidate);
    return {
      id: `landcand_rel_${sourceItemIdValue}`.replace(/[^a-zA-Z0-9_|]+/g, '_').slice(0, 180),
      run_id: runId,
      lane: RELATIONSHIP_INFERENCE_LANE,
      source_program_id: RELATIONSHIP_INFERENCE_PROGRAM_ID,
      source_item_id: sourceItemIdValue,
      display_name: `${fromName} ↔ ${toName}`,
      kind: 'other',
      summary: `${fromName} ${candidate.suggestedType} ${toName} (${candidate.primaryReason}, score ${candidate.score})`,
      canonical_url: '',
      status: 'pending',
      provenance: {
        from_entity_id: candidate.fromEntityId,
        to_entity_id: candidate.toEntityId,
        tier: candidate.tier,
        score_signals: candidate.scoreSignals,
      },
      payload: {
        from_entity_id: candidate.fromEntityId,
        to_entity_id: candidate.toEntityId,
        relationship_type: candidate.suggestedType,
        primary_reason: candidate.primaryReason,
        score: candidate.score,
        score_components: candidate.scoreComponents,
        tier: candidate.tier,
      },
      discovered_at: nowIso,
    };
  });
}
