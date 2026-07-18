/**
 * Scores entity candidates across names, identifiers, time, and geography without merging records.
 */
import type { DiscoveryCandidateRecord } from '../discovery/types.js';
import type { CanonicalEntity, EntityAlias } from '../entity.js';
import { isEntityKind } from '../entity-kinds.js';
import type { EntityLocation, Jurisdiction } from '../geography/location.js';
import { isTrustedIdentifierNamespace } from '../naming.js';
import {
  nameSimilarity,
  normalizeAlias,
  normalizeOrganizationName,
  parseAddress,
} from './normalization.js';
import type {
  DuplicateReviewQueueItem,
  MatchFactor,
  RankedEntityMatch,
  ResolutionCandidate,
  ResolutionContext,
  ResolutionDecision,
  ResolutionProfile,
  ResolutionResult,
} from './types.js';

const PROPOSE_THRESHOLD = 0.86;
const REVIEW_THRESHOLD = 0.55;
const AMBIGUITY_MARGIN = 0.12;

/**
 * black-book-8bck (identifier-dominant resolution): an exact match on a TRUSTED-namespace
 * identifier (Wikidata QID, LoC, VIAF, NPS, NRHP, NCES, etc. — see `../naming.js`) must clearly
 * outrank name similarity, whose maximum contribution is 0.55 (see `nameFactor` below). 0.65
 * dominates that ceiling on its own. An exact match on an UNTRUSTED/internal namespace keeps the
 * prior, smaller weight (0.1) — unchanged from before this bead, since an internal accession
 * number is not unambiguous evidence the way an external authority-control id is.
 */
const EXACT_TRUSTED_IDENTIFIER_SCORE = 0.65;
const EXACT_UNTRUSTED_IDENTIFIER_SCORE = 0.1;

function yearFromDate(value: string | undefined | null): number | undefined {
  if (!value) return undefined;
  const match = value.match(/^\d{4}/);
  return match ? Number(match[0]) : undefined;
}

function activeInYear(
  year: number,
  value: { readonly validFrom?: string; readonly validTo?: string | null },
): boolean {
  const from = yearFromDate(value.validFrom);
  const to = yearFromDate(value.validTo);
  return (from === undefined || year >= from) && (to === undefined || year <= to);
}

function entityNames(entity: CanonicalEntity, year?: number): readonly string[] {
  const aliases: readonly EntityAlias[] = entity.aliases ?? [];
  const names = [
    entity.displayName,
    ...aliases
      .filter((alias) => year === undefined || activeInYear(year, alias))
      .map((alias) => alias.value),
    ...(entity.school?.names ?? [])
      .filter((name) => year === undefined || activeInYear(year, name))
      .map((name) => name.name),
  ];
  return [...new Set(names)];
}

function nameFactor(candidate: ResolutionCandidate, entity: CanonicalEntity): MatchFactor {
  const candidateNames = [candidate.name, ...(candidate.aliases ?? [])];
  const canonicalNames = entityNames(entity, candidate.year);
  let best = 0;
  let matchedCandidate = candidate.name;
  let matchedCanonical = entity.displayName;
  for (const candidateName of candidateNames) {
    for (const canonicalName of canonicalNames) {
      const direct = nameSimilarity(candidateName, canonicalName);
      const organization =
        candidate.kind === 'organization' || entity.kind === 'organization'
          ? nameSimilarity(
              normalizeOrganizationName(candidateName),
              normalizeOrganizationName(canonicalName),
            )
          : 0;
      const score = Math.max(direct, organization);
      if (score > best) {
        best = score;
        matchedCandidate = candidateName;
        matchedCanonical = canonicalName;
      }
    }
  }
  const method = best === 1 ? 'exact normalized' : 'fuzzy';
  return {
    factor: 'name',
    score: best * 0.55,
    rationale: `${method} name match "${matchedCandidate}" ↔ "${matchedCanonical}" (${best.toFixed(3)})`,
  };
}

function identifierFactor(candidate: ResolutionCandidate, entity: CanonicalEntity): MatchFactor {
  const candidateIdentifiers = Object.entries(candidate.identifiers ?? {});
  const match = candidateIdentifiers.find(([system, value]) =>
    entity.identifiers?.some(
      (identifier) =>
        normalizeAlias(identifier.system) === normalizeAlias(system) &&
        normalizeAlias(identifier.value) === normalizeAlias(value),
    ),
  );
  if (!match) {
    return {
      factor: 'identifier',
      score: 0,
      rationale: candidateIdentifiers.length ? 'no identifier match' : 'no candidate identifier supplied',
    };
  }
  const trusted = isTrustedIdentifierNamespace(match[0]);
  return {
    factor: 'identifier',
    score: trusted ? EXACT_TRUSTED_IDENTIFIER_SCORE : EXACT_UNTRUSTED_IDENTIFIER_SCORE,
    rationale: trusted
      ? `exact identifier match on trusted namespace ${match[0]} outranks name similarity`
      : `exact identifier match for ${match[0]}`,
  };
}

function kindFactor(candidate: ResolutionCandidate, entity: CanonicalEntity): MatchFactor {
  if (!candidate.kind) {
    return { factor: 'kind', score: 0.08, rationale: 'candidate kind unspecified' };
  }
  return candidate.kind === entity.kind
    ? { factor: 'kind', score: 0.15, rationale: `entity kind matches ${candidate.kind}` }
    : {
        factor: 'kind',
        score: -0.35,
        rationale: `entity kind conflict: ${candidate.kind} vs ${entity.kind}`,
      };
}

function locationText(location: EntityLocation): string {
  return normalizeAlias(
    [location.label, location.modernZip?.zip, ...(location.jurisdictionIds ?? [])]
      .filter(Boolean)
      .join(' '),
  );
}

function relevantJurisdictions(
  jurisdictions: readonly Jurisdiction[],
  year: number | undefined,
): readonly Jurisdiction[] {
  return jurisdictions.filter(
    (jurisdiction) => year === undefined || activeInYear(year, jurisdiction),
  );
}

function geographyFactor(
  candidate: ResolutionCandidate,
  locations: readonly EntityLocation[],
  context: ResolutionContext,
): MatchFactor {
  const parsed = candidate.address ? parseAddress(candidate.address) : undefined;
  const hints = [
    ...(candidate.geographicHints ?? []),
    ...(parsed?.city ? [parsed.city] : []),
    ...(parsed?.state ? [parsed.state, `US-${parsed.state}`] : []),
  ]
    .map(normalizeAlias)
    .filter(Boolean);
  if (!hints.length) {
    return { factor: 'geography', score: 0.05, rationale: 'no geographic evidence supplied' };
  }
  const jurisdictions = relevantJurisdictions(context.jurisdictions ?? [], candidate.year);
  const jurisdictionNames = new Map(
    jurisdictions.flatMap((jurisdiction) => [
      [normalizeAlias(jurisdiction.id), normalizeAlias(jurisdiction.name)],
      [normalizeAlias(jurisdiction.name), normalizeAlias(jurisdiction.name)],
    ]),
  );
  const validLocations = locations.filter(
    (location) => candidate.year === undefined || activeInYear(candidate.year, location),
  );
  const locationValues = validLocations.flatMap((location) => {
    const values = [locationText(location)];
    for (const id of location.jurisdictionIds ?? []) {
      const name = jurisdictionNames.get(normalizeAlias(id));
      if (name) values.push(name);
    }
    return values;
  });
  const matches = hints.some((hint) =>
    locationValues.some((value) => value.includes(hint) || hint.includes(value)),
  );
  return {
    factor: 'geography',
    score: matches ? 0.12 : -0.08,
    rationale: matches
      ? 'candidate geography matches a valid entity location or jurisdiction'
      : 'candidate geography conflicts with known entity locations',
  };
}

function temporalFactor(
  candidate: ResolutionCandidate,
  entity: CanonicalEntity,
  locations: readonly EntityLocation[],
): MatchFactor {
  if (candidate.year === undefined) {
    return { factor: 'temporal', score: 0.05, rationale: 'candidate year unspecified' };
  }
  const impossiblePerson =
    entity.person &&
    ((entity.person.birthYear !== undefined &&
      entity.person.birthYear !== null &&
      candidate.year < entity.person.birthYear) ||
      (entity.person.deathYear !== undefined &&
        entity.person.deathYear !== null &&
        candidate.year > entity.person.deathYear));
  if (impossiblePerson) {
    return {
      factor: 'temporal',
      score: -0.4,
      rationale: 'candidate year falls outside person lifespan',
    };
  }
  const validLocations = locations.filter((location) => activeInYear(candidate.year!, location));
  if (locations.length && !validLocations.length) {
    return {
      factor: 'temporal',
      score: -0.2,
      rationale: 'no historical/current location is valid in candidate year',
    };
  }
  const role = validLocations.some((location) => location.role === 'historical')
    ? 'historical'
    : validLocations.some((location) => location.role === 'current')
      ? 'current'
      : 'dated';
  return {
    factor: 'temporal',
    score: 0.08,
    rationale: `${role} evidence is consistent with candidate year ${candidate.year}`,
  };
}

export function scoreEntityMatch(
  candidate: ResolutionCandidate,
  profile: ResolutionProfile,
  context: ResolutionContext = {},
): RankedEntityMatch {
  const factors = [
    nameFactor(candidate, profile.entity),
    kindFactor(candidate, profile.entity),
    identifierFactor(candidate, profile.entity),
    geographyFactor(candidate, profile.locations ?? [], context),
    temporalFactor(candidate, profile.entity, profile.locations ?? []),
  ];
  const confidence = Math.max(
    0,
    Math.min(
      1,
      factors.reduce((sum, factor) => sum + factor.score, 0),
    ),
  );
  return { entityId: profile.entity.id, confidence: Number(confidence.toFixed(4)), factors };
}

export function resolveEntityCandidate(
  candidate: ResolutionCandidate,
  profiles: readonly ResolutionProfile[],
  context: ResolutionContext = {},
): ResolutionResult {
  const rankedMatches = profiles
    .map((profile) => scoreEntityMatch(candidate, profile, context))
    .sort(
      (left, right) =>
        right.confidence - left.confidence || left.entityId.localeCompare(right.entityId),
    );
  const best = rankedMatches[0];
  const runnerUp = rankedMatches[1];
  if (!best || best.confidence < REVIEW_THRESHOLD) {
    return {
      candidateId: candidate.id,
      outcome: 'no_match',
      rankedMatches,
      rationale: ['No canonical entity reached the review confidence threshold.'],
    };
  }
  const ambiguous =
    runnerUp !== undefined && best.confidence - runnerUp.confidence < AMBIGUITY_MARGIN;
  if (best.confidence < PROPOSE_THRESHOLD || ambiguous) {
    return {
      candidateId: candidate.id,
      outcome: 'review_required',
      rankedMatches,
      rationale: [
        ambiguous
          ? 'Top matches are within the ambiguity margin; no entity was selected.'
          : 'Best match requires human review; no entity was selected.',
      ],
    };
  }
  return {
    candidateId: candidate.id,
    outcome: 'proposed_match',
    selectedEntityId: best.entityId,
    rankedMatches,
    rationale: best.factors.map((factor) => factor.rationale),
  };
}

function payloadStrings(
  payload: Readonly<Record<string, unknown>> | undefined,
  key: string,
): readonly string[] {
  const value = payload?.[key];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return [];
}

export function resolutionCandidateFromDiscovery(
  candidate: DiscoveryCandidateRecord,
): ResolutionCandidate {
  const payload = candidate.adapterRecord.payload;
  const yearValue = payload?.year;
  const identifiersValue = payload?.identifiers;
  const identifiers =
    identifiersValue && typeof identifiersValue === 'object' && !Array.isArray(identifiersValue)
      ? Object.fromEntries(
          Object.entries(identifiersValue).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
          ),
        )
      : undefined;
  const address = payloadStrings(payload, 'address')[0];
  const year = typeof yearValue === 'number' ? yearValue : undefined;
  const kindValue = payloadStrings(payload, 'kind')[0];
  return {
    id: candidate.id,
    name: payloadStrings(payload, 'name')[0] ?? candidate.adapterRecord.title ?? '',
    ...(kindValue !== undefined && isEntityKind(kindValue) ? { kind: kindValue } : {}),
    aliases: payloadStrings(payload, 'aliases'),
    ...(address !== undefined ? { address } : {}),
    ...(year !== undefined ? { year } : {}),
    geographicHints: candidate.geographicHints.map((hint) => hint.text),
    ...(identifiers !== undefined ? { identifiers } : {}),
    sourceReferenceIds: candidate.identity.sourceReferences.map(
      (reference) => `${reference.sourceId}:${reference.stableIdentifier}`,
    ),
  };
}

export function createDuplicateReviewQueueItem(
  candidate: ResolutionCandidate,
  result: ResolutionResult,
  createdAt: string,
): DuplicateReviewQueueItem {
  if (result.outcome !== 'review_required') {
    throw new Error(`Candidate ${candidate.id} is not review-required`);
  }
  return {
    id: `resolution-review:${candidate.id}`,
    candidateId: candidate.id,
    candidateName: candidate.name,
    status: 'pending',
    reason:
      result.rankedMatches[1] &&
      result.rankedMatches[0]!.confidence - result.rankedMatches[1].confidence < AMBIGUITY_MARGIN
        ? 'ambiguous_match'
        : 'low_confidence_match',
    proposedEntityIds: result.rankedMatches.slice(0, 3).map((match) => match.entityId),
    rankedMatches: result.rankedMatches,
    sourceReferenceIds: candidate.sourceReferenceIds,
    createdAt,
  };
}

export function applyResolutionDecision(
  decision: ResolutionDecision,
  appliedAt: string,
): ResolutionDecision {
  if (decision.status !== 'proposed') {
    throw new Error(`Resolution decision ${decision.id} is not proposed`);
  }
  return { ...decision, status: 'applied', appliedAt };
}

export function reverseResolutionDecision(
  decision: ResolutionDecision,
  input: { readonly reversedAt: string; readonly reversedBy: string; readonly reason: string },
): ResolutionDecision {
  if (decision.status !== 'applied') {
    throw new Error(`Resolution decision ${decision.id} is not applied`);
  }
  return {
    ...decision,
    status: 'reversed',
    reversedAt: input.reversedAt,
    reversedBy: input.reversedBy,
    reverseReason: input.reason,
  };
}
