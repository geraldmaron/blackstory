/**
 * Explainable Fellegi-Sunter-style additive scoring for ranked relationship candidates.
 * Score components stay separate so repo-si5a can calibrate m/u weights later.
 */
import type {
  RelationshipCandidate,
  RelationshipCandidateEntity,
  RelationshipCandidateReason,
} from '../../../domain/src/graph/relationship-candidates.ts';

export type CandidateAdjudicationTier = 'deterministic' | 'inferred';

export type CoParticipationCandidate = {
  readonly fromEntityId: string;
  readonly toEntityId: string;
  readonly eventId: string;
  readonly suggestedType: 'related_to';
  readonly reason: 'same_event_co_participation';
};

export type RankedRelationshipCandidate = {
  readonly fromEntityId: string;
  readonly toEntityId: string;
  readonly suggestedType: RelationshipCandidate['suggestedType'];
  readonly primaryReason: RelationshipCandidateReason | 'same_event_co_participation';
  readonly tier: CandidateAdjudicationTier;
  readonly score: number;
  readonly scoreComponents: Readonly<Record<string, number>>;
  readonly scoreSignals: readonly string[];
};

const COARSE_PRECISIONS = new Set(['county', 'state', 'region', 'country', 'unknown']);

function geohashProximityScore(geohashA?: string, geohashB?: string): number {
  if (!geohashA || !geohashB) return 0;
  if (geohashA.slice(0, 6) === geohashB.slice(0, 6)) return 30;
  if (geohashA.slice(0, 5) === geohashB.slice(0, 5)) return 25;
  if (geohashA.slice(0, 4) === geohashB.slice(0, 4)) return 15;
  return 0;
}

function locationPrecisionScore(precision?: string): number {
  const normalized = precision?.trim().toLowerCase() ?? '';
  if (!normalized || COARSE_PRECISIONS.has(normalized)) return 2;
  if (normalized === 'address' || normalized === 'building') return 10;
  if (normalized === 'institution' || normalized === 'site') return 8;
  if (normalized === 'city' || normalized === 'neighborhood') return 6;
  return 5;
}

function kindPairPrior(kindA?: string, kindB?: string): number {
  const kinds = new Set([kindA, kindB].filter(Boolean));
  if (kinds.has('person') && kinds.has('place')) return 20;
  if (kinds.has('person') && kinds.has('school')) return 20;
  if (kinds.has('person') && !kinds.has('place') && !kinds.has('school')) {
    if (kinds.has('person') && kinds.size === 1) return 18;
    if (kinds.has('person') && (kinds.has('organization') || kinds.has('institution'))) return 16;
  }
  if (kinds.has('place') && kinds.size === 1) return 2;
  if (kinds.has('event')) return 12;
  return 8;
}

function sharedDecadeCount(
  entityA: RelationshipCandidateEntity,
  entityB: RelationshipCandidateEntity,
): number {
  const decadesA = new Set(entityA.decades ?? []);
  if (decadesA.size === 0) return 0;
  return (entityB.decades ?? []).filter((decade) => decadesA.has(decade)).length;
}

function reasonBonus(reason: RelationshipCandidateReason | 'same_event_co_participation'): number {
  if (reason === 'mutual_mention') return 40;
  if (reason === 'same_event_co_participation') return 50;
  if (reason === 'shared_jurisdiction') return 10;
  if (reason === 'shared_decade_overlap') return 0;
  return 0;
}

function tierFor(
  reason: RelationshipCandidateReason | 'same_event_co_participation',
  reasons: ReadonlySet<RelationshipCandidateReason | 'same_event_co_participation'>,
): CandidateAdjudicationTier {
  if (reason === 'same_event_co_participation' || reasons.has('mutual_mention')) {
    return 'deterministic';
  }
  return 'inferred';
}

function entityById(
  entities: readonly RelationshipCandidateEntity[],
): ReadonlyMap<string, RelationshipCandidateEntity> {
  return new Map(entities.map((entity) => [entity.id, entity]));
}

function rankOne(
  fromEntityId: string,
  toEntityId: string,
  suggestedType: RelationshipCandidate['suggestedType'],
  primaryReason: RelationshipCandidateReason | 'same_event_co_participation',
  allReasons: ReadonlySet<RelationshipCandidateReason | 'same_event_co_participation'>,
  scoreSignals: readonly string[],
  entitiesById: ReadonlyMap<string, RelationshipCandidateEntity>,
): RankedRelationshipCandidate {
  const entityA = entitiesById.get(fromEntityId) ?? entitiesById.get(toEntityId);
  const entityB = entitiesById.get(toEntityId) ?? entitiesById.get(fromEntityId);
  const left = entitiesById.get(fromEntityId);
  const right = entitiesById.get(toEntityId);

  const geohashScore = geohashProximityScore(left?.geohash, right?.geohash);
  const precisionScore = Math.min(
    locationPrecisionScore(left?.locationPrecision),
    locationPrecisionScore(right?.locationPrecision),
  );
  const decadeScore = Math.min(sharedDecadeCount(left ?? entityA!, right ?? entityB!) * 5, 25);
  const kindScore = kindPairPrior(left?.kind, right?.kind);
  const reasonScore = reasonBonus(primaryReason);

  const scoreComponents: Record<string, number> = {
    geohash_proximity: geohashScore,
    location_precision: precisionScore,
    shared_decades: decadeScore,
    kind_pair_prior: kindScore,
    reason_bonus: reasonScore,
  };

  const score = Object.values(scoreComponents).reduce((sum, value) => sum + value, 0);

  return {
    fromEntityId,
    toEntityId,
    suggestedType,
    primaryReason,
    tier: tierFor(primaryReason, allReasons),
    score,
    scoreComponents,
    scoreSignals,
  };
}

/** Rank proposed and co-participation candidates with separate explainable score components. */
export function rankRelationshipCandidates(input: {
  readonly proposed: readonly RelationshipCandidate[];
  readonly coParticipation?: readonly CoParticipationCandidate[];
  readonly entities: readonly RelationshipCandidateEntity[];
}): readonly RankedRelationshipCandidate[] {
  const entitiesById = entityById(input.entities);
  const ranked: RankedRelationshipCandidate[] = [];
  const seen = new Set<string>();

  for (const candidate of input.proposed) {
    const key = `${candidate.fromEntityId}|${candidate.toEntityId}|${candidate.suggestedType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    ranked.push(
      rankOne(
        candidate.fromEntityId,
        candidate.toEntityId,
        candidate.suggestedType,
        candidate.reason,
        new Set([candidate.reason]),
        candidate.scoreSignals,
        entitiesById,
      ),
    );
  }

  for (const candidate of input.coParticipation ?? []) {
    const key = `${candidate.fromEntityId}|${candidate.toEntityId}|${candidate.suggestedType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    ranked.push(
      rankOne(
        candidate.fromEntityId,
        candidate.toEntityId,
        candidate.suggestedType,
        candidate.reason,
        new Set([candidate.reason]),
        [`same-event co-participation via ${candidate.eventId}`],
        entitiesById,
      ),
    );
  }

  return ranked.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    const leftKey = `${left.fromEntityId}|${left.toEntityId}|${left.suggestedType}`;
    const rightKey = `${right.fromEntityId}|${right.toEntityId}|${right.suggestedType}`;
    return leftKey.localeCompare(rightKey);
  });
}
