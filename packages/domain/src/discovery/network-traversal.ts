/**
 * Network Traversal Discovery.
 *
 * A catalog-seeded discovery methodology: start from a KNOWN canonical entity, read its
 * relationships (`bb_canonical.entity_relationships`), and for every related entity that is NOT
 * already in the catalog (catalog-match `no_match`), emit a private discovery candidate carrying
 * the relationship context that surfaced it. Historical networks are dense — every organization
 * has local chapter leaders, every court case has plaintiffs and attorneys, every movement has
 * organizers who never became famous — so the neighborhood of a cataloged entity is a high-yield,
 * low-noise seam for finding thinly attested people and places.
 *
 * Invariants (ADR-009 and constitution):
 * - Discovery NEVER publishes. Every candidate is `discovery-candidate.v1` (private research
 *   only); the publish guard is asserted at the campaign boundary.
 * - No network or DB access lives here. Relationships are supplied by the caller (fixtures in
 *   tests, an injected `readRelationships` reader backed by a `@repo/security` safe-fetch / DB
 *   client in production). The pure functions below are deterministic and side-effect free.
 * - Evidence before assertion: a relationship edge is a LEAD, not a claim. Candidates keep the
 *   originating predicate/direction as provenance and are scored for catalog-relative obscurity
 *   with the standard disclaimer — never for importance or truth.
 */
import { isTrustedIdentifierNamespace } from '../naming.js';
import type { AdapterCandidateRecord } from '../adapters/types.js';
import type { EntityKind } from '../entity-kinds.js';
import {
  resolveEntityCandidate,
  type ResolutionCandidate,
  type ResolutionContext,
  type ResolutionOutcome,
  type ResolutionProfile,
  type ResolutionResult,
} from '../resolution/index.js';
import { assertDiscoveryCannotPublish } from './guard.js';
import { buildCandidateIdentity } from './identity.js';
import {
  OBSCURITY_METHODOLOGY_DISCLAIMER,
  rankByObscurity,
  scoreObscurity,
  type ObscurityAssessment,
  type ObscurityReferenceCorpus,
} from './obscurity.js';
import {
  DISCOVERY_CANDIDATE_SCHEMA_VERSION,
  type DiscoveryCandidateRecord,
  type DiscoverySignal,
  type GeographicHint,
} from './types.js';

export const NETWORK_TRAVERSAL_CAMPAIGN_KIND = 'network-traversal.v1' as const;
export const NETWORK_TRAVERSAL_ADAPTER_ID = 'network-traversal' as const;
export const NETWORK_TRAVERSAL_PARSER_VERSION = 'network-traversal-parser.v1' as const;

/**
 * Neutral, non-low-authority classification for graph-derived leads. Deliberately NOT one of the
 * low-authority tiers (`community_oral` / `self_published` / `news_reportage`) — a relationship
 * out of the catalog is a structural lead, not a weak-source lead, so it earns no low-authority
 * obscurity boost.
 */
export const NETWORK_TRAVERSAL_CLASSIFICATION = 'catalog_relationship' as const;

export type NetworkTraversalDirection = 'outbound' | 'inbound';

/**
 * Descriptor of the entity on the OTHER end of a relationship edge from the seed. `entityId` is
 * present when the neighbor is an existing canonical row; it may be absent for a name-only mention
 * harvested from a relationship qualifier. `name` is required — without a name there is nothing to
 * launch a discovery campaign on.
 */
export type NetworkRelationshipTargetDescriptor = {
  readonly entityId?: string;
  readonly name: string;
  readonly kind?: EntityKind;
  readonly aliases?: readonly string[];
  readonly identifiers?: Readonly<Record<string, string>>;
  readonly geographicHints?: readonly string[];
  readonly year?: number;
};

/**
 * A single relationship row as read from `bb_canonical.entity_relationships`, augmented with a
 * descriptor of the neighbor entity. Callers project the row + neighbor display fields into this
 * shape; this module never touches the database.
 */
export type NetworkRelationshipRecord = {
  readonly id: string;
  readonly fromEntityId: string;
  readonly toEntityId: string;
  /** `relationship_type` — a profile predicate such as `member_of`, `challenged_law`, `founded`. */
  readonly predicate: string;
  readonly role?: string;
  readonly validFrom?: string;
  readonly validTo?: string | null;
  readonly target: NetworkRelationshipTargetDescriptor;
};

/** A neighbor of the seed entity, normalized for catalog-matching and candidate construction. */
export type NetworkTraversalTarget = {
  readonly seedEntityId: string;
  readonly relationshipId: string;
  readonly predicate: string;
  readonly direction: NetworkTraversalDirection;
  readonly role?: string;
  readonly targetEntityId?: string;
  readonly name: string;
  readonly kind?: EntityKind;
  readonly aliases: readonly string[];
  readonly identifiers: Readonly<Record<string, string>>;
  readonly geographicHints: readonly string[];
  readonly year?: number;
};

/** Relationship context embedded on every network-derived candidate payload for provenance. */
export type NetworkTraversalContext = {
  readonly methodology: typeof NETWORK_TRAVERSAL_CAMPAIGN_KIND;
  readonly seedEntityId: string;
  readonly relationshipId: string;
  readonly predicate: string;
  readonly direction: NetworkTraversalDirection;
  readonly role?: string;
  readonly targetEntityId?: string;
};

/**
 * PURE. Extract the neighbor descriptors from a seed entity's relationships.
 *
 * Only relationships that actually involve `entityId` are considered; direction records which side
 * the seed sits on (`outbound` when the seed is `from`, `inbound` when the seed is `to`). Edges
 * whose neighbor has no name, or that point back at the seed itself, are skipped.
 */
export function extractRelationshipTargets(
  entityId: string,
  relationships: readonly NetworkRelationshipRecord[],
): readonly NetworkTraversalTarget[] {
  const targets: NetworkTraversalTarget[] = [];
  for (const relationship of relationships) {
    const isFrom = relationship.fromEntityId === entityId;
    const isTo = relationship.toEntityId === entityId;
    if (!isFrom && !isTo) {
      continue;
    }
    const target = relationship.target;
    const name = target.name?.trim();
    if (!name) {
      continue;
    }
    if (target.entityId !== undefined && target.entityId === entityId) {
      continue;
    }
    targets.push({
      seedEntityId: entityId,
      relationshipId: relationship.id,
      predicate: relationship.predicate,
      direction: isFrom ? 'outbound' : 'inbound',
      ...(relationship.role !== undefined ? { role: relationship.role } : {}),
      ...(target.entityId !== undefined ? { targetEntityId: target.entityId } : {}),
      name,
      ...(target.kind !== undefined ? { kind: target.kind } : {}),
      aliases: target.aliases ?? [],
      identifiers: target.identifiers ?? {},
      geographicHints: target.geographicHints ?? [],
      ...(target.year !== undefined ? { year: target.year } : {}),
    });
  }
  return targets;
}

/** Build a resolution candidate from a traversal target for cheap catalog blocking. */
export function resolutionCandidateFromTarget(target: NetworkTraversalTarget): ResolutionCandidate {
  return {
    id: target.targetEntityId ?? `nettarget:${target.relationshipId}`,
    name: target.name,
    ...(target.kind !== undefined ? { kind: target.kind } : {}),
    aliases: target.aliases,
    ...(target.year !== undefined ? { year: target.year } : {}),
    geographicHints: target.geographicHints,
    ...(Object.keys(target.identifiers).length > 0 ? { identifiers: target.identifiers } : {}),
    sourceReferenceIds: [`network:${target.seedEntityId}:${target.relationshipId}`],
  };
}

/** A catalog-blocking function for traversal targets. Pure given a pure resolver. */
export type NetworkCatalogMatchFn = (target: NetworkTraversalTarget) => ResolutionResult;

/**
 * Build a `NetworkCatalogMatchFn` that reuses the deterministic entity resolver
 * (`resolveEntityCandidate`) against the supplied catalog profiles. Never merges or publishes —
 * propose / review / no_match only.
 */
export function catalogMatchFnFromProfiles(
  profiles: readonly ResolutionProfile[],
  context: ResolutionContext = {},
): NetworkCatalogMatchFn {
  return (target) =>
    resolveEntityCandidate(resolutionCandidateFromTarget(target), profiles, context);
}

export type NetworkTargetClassification = {
  readonly target: NetworkTraversalTarget;
  readonly outcome: ResolutionOutcome;
  readonly selectedEntityId?: string;
  readonly rationale: readonly string[];
};

/** PURE. Classify each target against the catalog, preserving the resolver outcome + rationale. */
export function classifyNetworkTargets(
  targets: readonly NetworkTraversalTarget[],
  catalogMatchFn: NetworkCatalogMatchFn,
): readonly NetworkTargetClassification[] {
  return targets.map((target) => {
    const result = catalogMatchFn(target);
    return {
      target,
      outcome: result.outcome,
      ...(result.selectedEntityId !== undefined
        ? { selectedEntityId: result.selectedEntityId }
        : {}),
      rationale: result.rationale,
    };
  });
}

/**
 * PURE. Filter traversal targets to those the catalog does not already know (`no_match`). These
 * are the leads worth a targeted discovery campaign.
 */
export function resolveUnknownTargets(
  targets: readonly NetworkTraversalTarget[],
  catalogMatchFn: NetworkCatalogMatchFn,
): readonly NetworkTraversalTarget[] {
  return classifyNetworkTargets(targets, catalogMatchFn)
    .filter((classification) => classification.outcome === 'no_match')
    .map((classification) => classification.target);
}

export type BuildNetworkCandidatesContext = {
  readonly runId: string;
  readonly capturedAt: string;
  readonly adapterId?: string;
  readonly parserVersion?: string;
  readonly sourceId?: string;
  readonly registryEntryId?: string;
  readonly classification?: string;
};

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'unknown'
  );
}

function targetKey(target: NetworkTraversalTarget): string {
  return target.targetEntityId ?? slug(target.name);
}

/** Classify a supplied geographic-hint string into a discovery `GeographicHint`. */
function geographicHintFromText(text: string): GeographicHint {
  const trimmed = text.trim();
  if (/^US-[A-Z]{2}$/.test(trimmed)) {
    return { text: trimmed, kind: 'state', confidence: 0.6 };
  }
  if (/,\s*[A-Z]{2}$/.test(trimmed)) {
    return { text: trimmed, kind: 'city', confidence: 0.6 };
  }
  return { text: trimmed, kind: 'unknown', confidence: 0.4 };
}

function networkSignal(target: NetworkTraversalTarget): DiscoverySignal {
  return {
    strength: 'medium',
    outcome: 'candidate_only',
    matchedClasses: ['historical'],
    matchedTerms: [target.predicate],
    reasons: [
      `Surfaced by catalog network traversal via "${target.predicate}" (${target.direction}) ` +
        `from seed entity ${target.seedEntityId}; a relationship lead, not a query-pack term match.`,
    ],
  };
}

function trustedIdentifierCount(identifiers: Readonly<Record<string, string>>): number {
  let trusted = 0;
  for (const [namespace, value] of Object.entries(identifiers)) {
    if (value.trim() && isTrustedIdentifierNamespace(namespace)) {
      trusted += 1;
    }
  }
  return trusted;
}

function buildNetworkAdapterRecord(
  target: NetworkTraversalTarget,
  context: BuildNetworkCandidatesContext,
  adapterId: string,
  parserVersion: string,
): AdapterCandidateRecord {
  const networkContext: NetworkTraversalContext = {
    methodology: NETWORK_TRAVERSAL_CAMPAIGN_KIND,
    seedEntityId: target.seedEntityId,
    relationshipId: target.relationshipId,
    predicate: target.predicate,
    direction: target.direction,
    ...(target.role !== undefined ? { role: target.role } : {}),
    ...(target.targetEntityId !== undefined ? { targetEntityId: target.targetEntityId } : {}),
  };
  const summary =
    `"${target.name}" surfaced via a "${target.predicate}" relationship (${target.direction}) ` +
    `from catalog entity ${target.seedEntityId}. Lead only — capture evidence before assertion.`;
  const payload: Record<string, unknown> = {
    name: target.name,
    ...(target.kind !== undefined ? { kind: target.kind } : {}),
    aliases: target.aliases,
    identifiers: target.identifiers,
    ...(target.year !== undefined ? { year: target.year } : {}),
    summary,
    networkContext,
  };
  return {
    stableIdentifier: `network:${target.seedEntityId}:${target.relationshipId}:${targetKey(target)}`,
    title: target.name,
    classification: context.classification ?? NETWORK_TRAVERSAL_CLASSIFICATION,
    payload,
    provenance: {
      sourceId: context.sourceId ?? 'src_network_traversal',
      adapterId,
      parserVersion,
      registryEntryId: context.registryEntryId ?? 'reg_network_traversal',
      runId: context.runId,
      capturedAt: context.capturedAt,
      sourceItemId: target.relationshipId,
      schemaVersion: NETWORK_TRAVERSAL_PARSER_VERSION,
    },
  };
}

/**
 * PURE. Produce private `discovery-candidate.v1` records for the unknown neighbors, with the
 * originating relationship context embedded in each candidate payload (`networkContext`).
 */
export function buildNetworkDiscoveryCandidates(
  unknownTargets: readonly NetworkTraversalTarget[],
  context: BuildNetworkCandidatesContext,
): readonly DiscoveryCandidateRecord[] {
  const adapterId = context.adapterId ?? NETWORK_TRAVERSAL_ADAPTER_ID;
  const parserVersion = context.parserVersion ?? NETWORK_TRAVERSAL_PARSER_VERSION;
  return unknownTargets.map((target, index) => {
    const record = buildNetworkAdapterRecord(target, context, adapterId, parserVersion);
    const geographicHints = target.geographicHints.map(geographicHintFromText);
    return {
      schemaVersion: DISCOVERY_CANDIDATE_SCHEMA_VERSION,
      id: `netdisc_${target.seedEntityId}_${index}_${targetKey(target)}`,
      identity: buildCandidateIdentity(record),
      adapterRecord: record,
      status: 'pending',
      ingestMode: 'api',
      signals: networkSignal(target),
      geographicHints,
      retryCount: 0,
      createdAt: context.capturedAt,
      updatedAt: context.capturedAt,
    };
  });
}

/** Read the embedded network context back off a candidate, when present. */
export function networkContextOf(
  candidate: DiscoveryCandidateRecord,
): NetworkTraversalContext | undefined {
  const value = candidate.adapterRecord.payload?.networkContext;
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const context = value as Partial<NetworkTraversalContext>;
  if (
    context.methodology === NETWORK_TRAVERSAL_CAMPAIGN_KIND &&
    typeof context.seedEntityId === 'string' &&
    typeof context.relationshipId === 'string' &&
    typeof context.predicate === 'string' &&
    (context.direction === 'outbound' || context.direction === 'inbound')
  ) {
    return context as NetworkTraversalContext;
  }
  return undefined;
}

export type NetworkTraversalRankedLead = {
  readonly candidateId: string;
  readonly name: string;
  readonly predicate: string;
  readonly direction: NetworkTraversalDirection;
  readonly seedEntityId: string;
  readonly relationshipId: string;
  readonly hasTrustedIdentifier: boolean;
  readonly obscurity: ObscurityAssessment;
};

export type RunNetworkTraversalCampaignInput = {
  readonly seedEntityId: string;
  /** Relationships already read from `bb_canonical.entity_relationships` for the seed. */
  readonly relationships?: readonly NetworkRelationshipRecord[];
  /**
   * Optional injected reader (fixtures in tests; a safe-fetch/DB-backed reader in production).
   * When provided it wins over `relationships`. This module performs no I/O itself.
   */
  readonly readRelationships?: (seedEntityId: string) => readonly NetworkRelationshipRecord[];
  readonly catalogProfiles: readonly ResolutionProfile[];
  readonly catalogContext?: ResolutionContext;
  /** Reference titles for the obscurity IDF corpus. */
  readonly catalogTitles: readonly string[];
  readonly runId: string;
  readonly capturedAt: string;
  readonly completedAt: string;
  readonly adapterId?: string;
  readonly parserVersion?: string;
  readonly sourceId?: string;
  readonly registryEntryId?: string;
  /** Cap the number of unknown neighbors turned into candidates (bounded fan-out). */
  readonly maxCandidates?: number;
};

export type NetworkTraversalCampaignResult = {
  readonly kind: typeof NETWORK_TRAVERSAL_CAMPAIGN_KIND;
  readonly seedEntityId: string;
  readonly relationshipsRead: number;
  readonly targetsExtracted: number;
  readonly proposedMatchCount: number;
  readonly reviewRequiredCount: number;
  readonly unknownCount: number;
  readonly candidates: readonly DiscoveryCandidateRecord[];
  readonly ranked: readonly NetworkTraversalRankedLead[];
  readonly disclaimer: typeof OBSCURITY_METHODOLOGY_DISCLAIMER;
  readonly completedAt: string;
};

/**
 * Orchestrate a Network Traversal Discovery campaign for one seed entity:
 * read relationships → extract neighbors → catalog-block → keep the unknowns → build private
 * candidates → score obscurity → yield a ranked summary. Never publishes.
 */
export function runNetworkTraversalCampaign(
  input: RunNetworkTraversalCampaignInput,
): NetworkTraversalCampaignResult {
  // Boundary guard: this methodology only ever emits private candidates. Assert the publish guard
  // is armed and that our emit operation is not a forbidden publication side effect.
  assertDiscoveryCannotPublish({
    operation: 'network_traversal_emit_candidates',
    target: input.seedEntityId,
  });

  const relationships = input.readRelationships
    ? input.readRelationships(input.seedEntityId)
    : (input.relationships ?? []);

  const targets = extractRelationshipTargets(input.seedEntityId, relationships);
  const catalogMatchFn = catalogMatchFnFromProfiles(
    input.catalogProfiles,
    input.catalogContext ?? {},
  );
  const classifications = classifyNetworkTargets(targets, catalogMatchFn);

  const proposedMatchCount = classifications.filter((c) => c.outcome === 'proposed_match').length;
  const reviewRequiredCount = classifications.filter((c) => c.outcome === 'review_required').length;

  const unknownTargetsAll = classifications
    .filter((c) => c.outcome === 'no_match')
    .map((c) => c.target);
  const unknownTargets =
    input.maxCandidates !== undefined
      ? unknownTargetsAll.slice(0, Math.max(0, input.maxCandidates))
      : unknownTargetsAll;

  const candidates = buildNetworkDiscoveryCandidates(unknownTargets, {
    runId: input.runId,
    capturedAt: input.capturedAt,
    ...(input.adapterId !== undefined ? { adapterId: input.adapterId } : {}),
    ...(input.parserVersion !== undefined ? { parserVersion: input.parserVersion } : {}),
    ...(input.sourceId !== undefined ? { sourceId: input.sourceId } : {}),
    ...(input.registryEntryId !== undefined ? { registryEntryId: input.registryEntryId } : {}),
  });

  const corpus: ObscurityReferenceCorpus = { catalogTitles: input.catalogTitles };
  const assessments = candidates.map((candidate) =>
    scoreObscurity({ candidate, corpus, assessedAt: input.completedAt }),
  );
  const rankedAssessments = rankByObscurity(assessments);

  const byCandidateId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const ranked: NetworkTraversalRankedLead[] = rankedAssessments.map((obscurity) => {
    const candidate = byCandidateId.get(obscurity.candidateId)!;
    const context = networkContextOf(candidate);
    const identifiers = candidate.adapterRecord.payload?.identifiers;
    const hasTrustedIdentifier =
      identifiers && typeof identifiers === 'object' && !Array.isArray(identifiers)
        ? trustedIdentifierCount(identifiers as Record<string, string>) > 0
        : false;
    return {
      candidateId: candidate.id,
      name: candidate.adapterRecord.title ?? candidate.id,
      predicate: context?.predicate ?? 'unknown',
      direction: context?.direction ?? 'outbound',
      seedEntityId: context?.seedEntityId ?? input.seedEntityId,
      relationshipId: context?.relationshipId ?? 'unknown',
      hasTrustedIdentifier,
      obscurity,
    };
  });

  return {
    kind: NETWORK_TRAVERSAL_CAMPAIGN_KIND,
    seedEntityId: input.seedEntityId,
    relationshipsRead: relationships.length,
    targetsExtracted: targets.length,
    proposedMatchCount,
    reviewRequiredCount,
    unknownCount: unknownTargetsAll.length,
    candidates,
    ranked,
    disclaimer: OBSCURITY_METHODOLOGY_DISCLAIMER,
    completedAt: input.completedAt,
  };
}
