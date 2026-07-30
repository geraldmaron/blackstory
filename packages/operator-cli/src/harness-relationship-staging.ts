/**
 * Stage harness spatiotemporal adjudicator output into bb_research.landscape_candidates.
 * LLM tier only — never writes bb_canonical.entity_relationships.
 */
import type { AdjudicatedRelationship } from '@repo/research-harness';

export const HARNESS_ADJUDICATION_LANE = 'harness-spatiotemporal' as const;
export const HARNESS_ADJUDICATION_PROGRAM_ID = 'harness-spatiotemporal-adjudicator' as const;

export type HarnessAdjudicationRow = {
  readonly id: string;
  readonly run_id: string;
  readonly lane: typeof HARNESS_ADJUDICATION_LANE;
  readonly source_program_id: string;
  readonly source_item_id: string;
  readonly display_name: string;
  readonly kind: string;
  readonly summary: string;
  readonly canonical_url: string;
  readonly status: 'pending' | 'quarantined';
  readonly provenance: {
    readonly subject_a_id: string;
    readonly subject_b_id: string;
    readonly theme: string;
    readonly metro: string;
    readonly tier: 'llm';
  };
  readonly payload: {
    readonly subject_a_id: string;
    readonly subject_b_id: string;
    readonly relationship_type: string;
    readonly confidence: number;
    readonly rationale: string;
    readonly tier: 'llm';
  };
  readonly discovered_at: string;
};

export type HarnessStagingInserter = (rows: readonly HarnessAdjudicationRow[]) => Promise<void>;

function normalizeRelationshipType(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/gu, '_');
  return normalized.length > 0 ? normalized : 'other';
}

export function shapeHarnessAdjudicationRows(
  relations: readonly AdjudicatedRelationship[],
  runId: string,
  theme: string,
  metro: string,
  nowIso: string = new Date().toISOString(),
): readonly HarnessAdjudicationRow[] {
  return relations
    .filter((relation) => relation.relationType.trim().toLowerCase() !== 'none')
    .map((relation) => {
      const relationshipType = normalizeRelationshipType(relation.relationType);
      const sourceItemId = `${relation.subjectAId}|${relation.subjectBId}|${relationshipType}`;
      const quarantine = relation.confidence < 0.35;
      return {
        id: `landcand_harness_${sourceItemId}`.replace(/[^a-zA-Z0-9_|]+/g, '_').slice(0, 180),
        run_id: runId,
        lane: HARNESS_ADJUDICATION_LANE,
        source_program_id: HARNESS_ADJUDICATION_PROGRAM_ID,
        source_item_id: sourceItemId,
        display_name: `${relation.subjectAId} ↔ ${relation.subjectBId}`,
        kind: 'other',
        summary: `${relation.subjectAId} ${relationshipType} ${relation.subjectBId} (${relation.rationale.slice(0, 180)})`,
        canonical_url: '',
        status: quarantine ? 'quarantined' : 'pending',
        provenance: {
          subject_a_id: relation.subjectAId,
          subject_b_id: relation.subjectBId,
          theme,
          metro,
          tier: 'llm',
        },
        payload: {
          subject_a_id: relation.subjectAId,
          subject_b_id: relation.subjectBId,
          relationship_type: relationshipType,
          confidence: relation.confidence,
          rationale: relation.rationale,
          tier: 'llm',
        },
        discovered_at: nowIso,
      };
    });
}

export async function stageHarnessAdjudicatedRelationships(
  relations: readonly AdjudicatedRelationship[],
  runId: string,
  theme: string,
  metro: string,
  insert: HarnessStagingInserter,
  nowIso: string = new Date().toISOString(),
): Promise<readonly HarnessAdjudicationRow[]> {
  const rows = shapeHarnessAdjudicationRows(relations, runId, theme, metro, nowIso);
  if (rows.length > 0) {
    await insert(rows);
  }
  return rows;
}
