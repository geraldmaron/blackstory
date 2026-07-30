/**
 * Pure helpers for promoting relationship-inference landscape candidates
 * into bb_canonical.entity_relationships.
 */
import { createHash } from 'node:crypto';
import { treatAsLiving, type LivingStatus } from '../../../domain/src/living.ts';
import { RELATIONSHIP_TYPES, type RelationshipType } from '../../../domain/src/relationship.ts';
import type { AbsorbedToSurvivorMap } from './entity-hub-merge.ts';
import { remapEntityId } from './entity-hub-merge.ts';
import { RELATIONSHIP_INFERENCE_LANE } from './relationship-candidate-staging.ts';

const RELATIONSHIP_TYPE_SET = new Set<string>(RELATIONSHIP_TYPES);

export type RelationshipCandidatePayload = {
  readonly from_entity_id?: string;
  readonly to_entity_id?: string;
  readonly relationship_type?: string;
  readonly primary_reason?: string;
  readonly score?: number;
  readonly score_components?: Readonly<Record<string, number>>;
  readonly tier?: string;
};

export type LandscapeCandidateRow = {
  readonly id: string;
  readonly status: string;
  readonly lane: string;
  readonly payload: RelationshipCandidatePayload;
};

export type EntityLivingProfile = {
  readonly id: string;
  readonly kind: string;
  readonly livingStatus: LivingStatus;
};

export type ParsedRelationshipCandidate = {
  readonly candidateId: string;
  readonly fromEntityId: string;
  readonly toEntityId: string;
  readonly relationshipType: RelationshipType;
  readonly primaryReason: string;
  readonly tier: string;
  readonly score: number;
};

export type PromoteSkipReason =
  | 'INVALID_PAYLOAD'
  | 'INVALID_RELATIONSHIP_TYPE'
  | 'SELF_LOOP'
  | 'EDGE_EXISTS'
  | 'SKIP_LIVING_REVIEW'
  | 'NOT_DETERMINISTIC';

export type PromoteDecision =
  | { readonly action: 'insert'; readonly candidate: ParsedRelationshipCandidate; readonly relationshipId: string }
  | { readonly action: 'skip'; readonly candidateId: string; readonly reason: PromoteSkipReason; readonly detail?: string };

export function inferredRelationshipId(
  fromEntityId: string,
  relationshipType: RelationshipType,
  toEntityId: string,
): string {
  const digest = createHash('sha256')
    .update(`${fromEntityId}|${relationshipType}|${toEntityId}`)
    .digest('hex');
  return `rel_inf_${digest.slice(0, 24)}`;
}

export function parseRelationshipCandidate(row: LandscapeCandidateRow): ParsedRelationshipCandidate | null {
  if (row.lane !== RELATIONSHIP_INFERENCE_LANE) return null;
  const fromEntityId = row.payload.from_entity_id?.trim();
  const toEntityId = row.payload.to_entity_id?.trim();
  const relationshipType = row.payload.relationship_type?.trim();
  if (!fromEntityId || !toEntityId || !relationshipType) return null;
  if (!RELATIONSHIP_TYPE_SET.has(relationshipType)) return null;
  return {
    candidateId: row.id,
    fromEntityId,
    toEntityId,
    relationshipType: relationshipType as RelationshipType,
    primaryReason: row.payload.primary_reason?.trim() ?? 'inferred',
    tier: row.payload.tier?.trim() ?? 'deterministic',
    score: typeof row.payload.score === 'number' ? row.payload.score : 0,
  };
}

export function isDeterministicTier(tier: string): boolean {
  return tier === 'deterministic';
}

export function requiresLivingPersonReview(
  fromEntityId: string,
  toEntityId: string,
  profiles: ReadonlyMap<string, EntityLivingProfile>,
): boolean {
  for (const entityId of [fromEntityId, toEntityId]) {
    const profile = profiles.get(entityId);
    if (!profile || profile.kind !== 'person') continue;
    if (profile.livingStatus === 'living' || treatAsLiving(profile.livingStatus)) {
      return true;
    }
  }
  return false;
}

export type ExistingEdgeKey = string;

export function edgeExistenceKey(
  fromEntityId: string,
  toEntityId: string,
  relationshipType: string,
): ExistingEdgeKey {
  return `${fromEntityId}|${toEntityId}|${relationshipType}`;
}

export function edgeExistsEitherDirection(
  fromEntityId: string,
  toEntityId: string,
  relationshipType: string,
  existing: ReadonlySet<ExistingEdgeKey>,
): boolean {
  return (
    existing.has(edgeExistenceKey(fromEntityId, toEntityId, relationshipType)) ||
    existing.has(edgeExistenceKey(toEntityId, fromEntityId, relationshipType))
  );
}

export function buildExistingEdgeKeySet(
  rows: readonly { readonly fromEntityId: string; readonly toEntityId: string; readonly relationshipType: string }[],
): ReadonlySet<ExistingEdgeKey> {
  const keys = new Set<ExistingEdgeKey>();
  for (const row of rows) {
    keys.add(edgeExistenceKey(row.fromEntityId, row.toEntityId, row.relationshipType));
  }
  return keys;
}

export function remapCandidateEndpoints(
  candidate: ParsedRelationshipCandidate,
  mergeMap: AbsorbedToSurvivorMap,
): ParsedRelationshipCandidate {
  return {
    ...candidate,
    fromEntityId: remapEntityId(candidate.fromEntityId, mergeMap),
    toEntityId: remapEntityId(candidate.toEntityId, mergeMap),
  };
}

export function shouldPromoteDeterministicCandidate(
  payload: RelationshipCandidatePayload,
): boolean {
  const tier = payload.tier?.trim();
  if (tier === undefined || tier === '') return true;
  return isDeterministicTier(tier);
}

export function planRelationshipPromotion(
  rows: readonly LandscapeCandidateRow[],
  profiles: ReadonlyMap<string, EntityLivingProfile>,
  existingEdges: ReadonlySet<ExistingEdgeKey>,
  mergeMap: AbsorbedToSurvivorMap,
): readonly PromoteDecision[] {
  const decisions: PromoteDecision[] = [];

  for (const row of rows) {
    if (row.status !== 'pending') continue;
    if (!shouldPromoteDeterministicCandidate(row.payload)) {
      decisions.push({
        action: 'skip',
        candidateId: row.id,
        reason: 'NOT_DETERMINISTIC',
        detail: row.payload.tier,
      });
      continue;
    }
    const parsed = parseRelationshipCandidate(row);
    if (!parsed) {
      decisions.push({ action: 'skip', candidateId: row.id, reason: 'INVALID_PAYLOAD' });
      continue;
    }

    const candidate = remapCandidateEndpoints(parsed, mergeMap);
    if (candidate.fromEntityId === candidate.toEntityId) {
      decisions.push({ action: 'skip', candidateId: row.id, reason: 'SELF_LOOP' });
      continue;
    }
    if (requiresLivingPersonReview(candidate.fromEntityId, candidate.toEntityId, profiles)) {
      decisions.push({ action: 'skip', candidateId: row.id, reason: 'SKIP_LIVING_REVIEW' });
      continue;
    }
    if (edgeExistsEitherDirection(
      candidate.fromEntityId,
      candidate.toEntityId,
      candidate.relationshipType,
      existingEdges,
    )) {
      decisions.push({ action: 'skip', candidateId: row.id, reason: 'EDGE_EXISTS' });
      continue;
    }

    decisions.push({
      action: 'insert',
      candidate,
      relationshipId: inferredRelationshipId(
        candidate.fromEntityId,
        candidate.relationshipType,
        candidate.toEntityId,
      ),
    });
  }

  return decisions;
}

export type EdgeCoverageSnapshot = {
  readonly totalEntities: number;
  readonly entitiesWithAcceptedEdge: number;
};

export function formatEdgeCoverage(snapshot: EdgeCoverageSnapshot): string {
  const pct =
    snapshot.totalEntities === 0
      ? 0
      : Math.round((snapshot.entitiesWithAcceptedEdge / snapshot.totalEntities) * 1000) / 10;
  return `${snapshot.entitiesWithAcceptedEdge}/${snapshot.totalEntities} entities with ≥1 accepted edge (${pct}%)`;
}
