/**
 * Repeatable, non-auto-publish relationship candidate extraction for research
 * triage. Proposes edges from shared geography, jurisdiction, or mutual mentions
 * without assigning numeric scores or mutating publication state.
 */

export const RELATIONSHIP_CANDIDATE_TYPES = ['related_to', 'located_at', 'occurred_at'] as const;
export type RelationshipCandidateType = (typeof RELATIONSHIP_CANDIDATE_TYPES)[number];

export const RELATIONSHIP_CANDIDATE_REASONS = [
  'shared_geohash_prefix',
  'shared_jurisdiction',
  'mutual_mention',
] as const;
export type RelationshipCandidateReason = (typeof RELATIONSHIP_CANDIDATE_REASONS)[number];

export type RelationshipCandidate = {
  readonly fromEntityId: string;
  readonly toEntityId: string;
  readonly suggestedType: RelationshipCandidateType;
  readonly reason: RelationshipCandidateReason;
  readonly scoreSignals: readonly string[];
};

export type RelationshipCandidateEntity = {
  readonly id: string;
  readonly kind?: string;
  readonly jurisdictionLabel?: string;
  readonly geohash?: string;
  readonly mentionedEntityIds?: readonly string[];
};

export type ExistingRelationshipRef = {
  readonly fromEntityId: string;
  readonly toEntityId: string;
  readonly type: string;
};

export type ProposeRelationshipCandidatesInput = {
  readonly entities: readonly RelationshipCandidateEntity[];
  readonly existingRelationships?: readonly ExistingRelationshipRef[];
  readonly geohashPrefixLength?: number;
};

const DEFAULT_GEOHASH_PREFIX_LENGTH = 4;
const MAX_CANDIDATES = 200;

const REASON_PRIORITY: Readonly<Record<RelationshipCandidateReason, number>> = {
  mutual_mention: 0,
  shared_geohash_prefix: 1,
  shared_jurisdiction: 2,
};

function normalizeJurisdiction(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function pairKey(entityA: string, entityB: string): string {
  return entityA < entityB ? `${entityA}|${entityB}` : `${entityB}|${entityA}`;
}

function hasExistingRelationship(
  entityA: string,
  entityB: string,
  existingRelationships: readonly ExistingRelationshipRef[],
): boolean {
  return existingRelationships.some(
    (relationship) =>
      (relationship.fromEntityId === entityA && relationship.toEntityId === entityB) ||
      (relationship.fromEntityId === entityB && relationship.toEntityId === entityA),
  );
}

function suggestedTypeForSignals(
  reasons: ReadonlySet<RelationshipCandidateReason>,
  entityA: RelationshipCandidateEntity,
  entityB: RelationshipCandidateEntity,
): RelationshipCandidateType {
  if (reasons.has('shared_geohash_prefix')) {
    if (entityA.kind === 'event' || entityB.kind === 'event') {
      return 'occurred_at';
    }
    return 'located_at';
  }
  if (reasons.has('mutual_mention') && (entityA.kind === 'event' || entityB.kind === 'event')) {
    return 'occurred_at';
  }
  return 'related_to';
}

function primaryReason(reasons: ReadonlySet<RelationshipCandidateReason>): RelationshipCandidateReason {
  return [...reasons].sort(
    (a, b) => REASON_PRIORITY[a] - REASON_PRIORITY[b],
  )[0] as RelationshipCandidateReason;
}

function canonicalDirection(
  entityA: RelationshipCandidateEntity,
  entityB: RelationshipCandidateEntity,
  suggestedType: RelationshipCandidateType,
): { readonly fromEntityId: string; readonly toEntityId: string } {
  if (suggestedType === 'occurred_at') {
    if (entityA.kind === 'event' && entityB.kind !== 'event') {
      return { fromEntityId: entityA.id, toEntityId: entityB.id };
    }
    if (entityB.kind === 'event' && entityA.kind !== 'event') {
      return { fromEntityId: entityB.id, toEntityId: entityA.id };
    }
  }
  return entityA.id < entityB.id
    ? { fromEntityId: entityA.id, toEntityId: entityB.id }
    : { fromEntityId: entityB.id, toEntityId: entityA.id };
}

function buildScoreSignals(
  entityA: RelationshipCandidateEntity,
  entityB: RelationshipCandidateEntity,
  reasons: ReadonlySet<RelationshipCandidateReason>,
  geohashPrefixLength: number,
): readonly string[] {
  const signals: string[] = [];
  if (reasons.has('shared_geohash_prefix')) {
    const prefix = entityA.geohash?.slice(0, geohashPrefixLength) ?? '';
    signals.push(`shared geohash prefix "${prefix}"`);
  }
  if (reasons.has('shared_jurisdiction')) {
    signals.push(`shared jurisdiction "${entityA.jurisdictionLabel?.trim() ?? ''}"`);
  }
  if (reasons.has('mutual_mention')) {
    signals.push('entities mention each other in catalog metadata');
  }
  return signals;
}

/**
 * Proposes relationship candidates for operator triage. Never auto-publishes;
 * results are capped and sorted deterministically for repeatable research waves.
 */
export function proposeRelationshipCandidates(
  input: ProposeRelationshipCandidatesInput,
): readonly RelationshipCandidate[] {
  const geohashPrefixLength = input.geohashPrefixLength ?? DEFAULT_GEOHASH_PREFIX_LENGTH;
  const existingRelationships = input.existingRelationships ?? [];
  const sortedEntities = [...input.entities].sort((a, b) => a.id.localeCompare(b.id));

  const mentionSets = new Map<string, Set<string>>();
  for (const entity of sortedEntities) {
    mentionSets.set(
      entity.id,
      new Set((entity.mentionedEntityIds ?? []).filter((mentionedId) => mentionedId !== entity.id)),
    );
  }

  type AccumulatedCandidate = {
    readonly entityA: RelationshipCandidateEntity;
    readonly entityB: RelationshipCandidateEntity;
    readonly reasons: Set<RelationshipCandidateReason>;
  };

  const accumulated = new Map<string, AccumulatedCandidate>();

  for (let index = 0; index < sortedEntities.length; index += 1) {
    const entityA = sortedEntities[index];
    if (!entityA) continue;

    for (let inner = index + 1; inner < sortedEntities.length; inner += 1) {
      const entityB = sortedEntities[inner];
      if (!entityB) continue;

      if (hasExistingRelationship(entityA.id, entityB.id, existingRelationships)) {
        continue;
      }

      const reasons = new Set<RelationshipCandidateReason>();

      const prefixA = entityA.geohash?.slice(0, geohashPrefixLength);
      const prefixB = entityB.geohash?.slice(0, geohashPrefixLength);
      if (prefixA && prefixB && prefixA === prefixB) {
        reasons.add('shared_geohash_prefix');
      }

      const jurisdictionA = normalizeJurisdiction(entityA.jurisdictionLabel);
      const jurisdictionB = normalizeJurisdiction(entityB.jurisdictionLabel);
      if (jurisdictionA && jurisdictionB && jurisdictionA === jurisdictionB) {
        reasons.add('shared_jurisdiction');
      }

      const mentionsA = mentionSets.get(entityA.id);
      const mentionsB = mentionSets.get(entityB.id);
      if (
        (mentionsA?.has(entityB.id) ?? false) ||
        (mentionsB?.has(entityA.id) ?? false)
      ) {
        reasons.add('mutual_mention');
      }

      if (reasons.size === 0) {
        continue;
      }

      accumulated.set(pairKey(entityA.id, entityB.id), {
        entityA,
        entityB,
        reasons,
      });
    }
  }

  const candidates: RelationshipCandidate[] = [];

  for (const { entityA, entityB, reasons } of [...accumulated.values()].sort((left, right) =>
    pairKey(left.entityA.id, left.entityB.id).localeCompare(
      pairKey(right.entityA.id, right.entityB.id),
    ),
  )) {
    const suggestedType = suggestedTypeForSignals(reasons, entityA, entityB);
    const direction = canonicalDirection(entityA, entityB, suggestedType);
    candidates.push({
      fromEntityId: direction.fromEntityId,
      toEntityId: direction.toEntityId,
      suggestedType,
      reason: primaryReason(reasons),
      scoreSignals: buildScoreSignals(entityA, entityB, reasons, geohashPrefixLength),
    });
  }

  candidates.sort((left, right) => {
    const leftKey = `${left.fromEntityId}|${left.toEntityId}|${left.suggestedType}|${left.reason}`;
    const rightKey = `${right.fromEntityId}|${right.toEntityId}|${right.suggestedType}|${right.reason}`;
    return leftKey.localeCompare(rightKey);
  });

  return candidates.slice(0, MAX_CANDIDATES);
}
