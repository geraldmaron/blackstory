/**
 * Graylist recall lane (BB-073 acceptance criterion 4): below-threshold discovery candidates
 * are parked with a disposition tag instead of being silently dropped, so they remain queryable
 * for corroboration when new evidence arrives later (the "things that fall through the cracks"
 * safety net from the owner brief this bead traces back to).
 *
 * This is new scaffolding — nothing named "graylist" existed in packages/domain/src before this
 * bead (confirmed via `grep -rl graylist packages/domain/src`). It composes with the existing
 * discovery pipeline (./pipeline.ts, ./quarantine.ts) and relevance engine
 * (../relevance/engine.ts) rather than replacing either: a candidate that
 * `evaluateCandidateRelevance` (../relevance/index.ts) does not resolve to `include` is a
 * graylist candidate, not a discarded one. Distinct from `./quarantine.ts`, which handles
 * adapter/ingestion *failures* (retry/quarantine/dead-letter) — graylist parking is for
 * candidates that ingested and scored fine but didn't clear the relevance bar on their own.
 *
 * Parking never bypasses `assertDiscoveryCannotPublish` (./guard.ts) — a promoted graylist
 * entry only re-enters ordinary relevance/confidence review; nothing here writes a public
 * projection.
 */
import type { RelevanceAssessment } from '../relevance/types.js';
import type { DiscoveryCandidateRecord } from './types.js';

export const GRAYLIST_SCHEMA_VERSION = 'discovery-graylist.v1' as const;

export const GRAYLIST_DISPOSITIONS = [
  'weak_signal_uncorroborated',
  'below_threshold',
  'negative_only_signal',
  'duplicate_of_included',
  'awaiting_corroboration',
] as const;

export type GraylistDisposition = (typeof GRAYLIST_DISPOSITIONS)[number];

export const GRAYLIST_ENTRY_STATUSES = ['parked', 'promoted', 'archived'] as const;

export type GraylistEntryStatus = (typeof GRAYLIST_ENTRY_STATUSES)[number];

export type GraylistEntry = {
  readonly schemaVersion: typeof GRAYLIST_SCHEMA_VERSION;
  readonly id: string;
  readonly candidateId: string;
  readonly identityKey: string;
  readonly adapterId: string;
  readonly sourceClassification?: string;
  readonly disposition: GraylistDisposition;
  readonly reason: string;
  /** Normalized lookup key for later corroboration search (see corroborationKeyFor). */
  readonly corroborationKey: string;
  readonly compositeScore: number;
  readonly status: GraylistEntryStatus;
  readonly parkedAt: string;
  readonly updatedAt: string;
  readonly promotedAt?: string;
  readonly promotedBy?: string;
  readonly promotionReason?: string;
};

export type GraylistStore = {
  get(id: string): GraylistEntry | undefined;
  list(): readonly GraylistEntry[];
  save(entry: GraylistEntry): void;
};

export function createInMemoryGraylistStore(seed: readonly GraylistEntry[] = []): GraylistStore {
  const entries = new Map<string, GraylistEntry>(seed.map((entry) => [entry.id, entry]));
  return {
    get(id) {
      return entries.get(id);
    },
    list() {
      return [...entries.values()];
    },
    save(entry) {
      entries.set(entry.id, entry);
    },
  };
}

/** A candidate is parked whenever relevance did not resolve it to `include` — never dropped. */
export function shouldPark(assessment: Pick<RelevanceAssessment, 'decision'>): boolean {
  return assessment.decision !== 'include';
}

function hasNegativeOnlyGateFailure(assessment: RelevanceAssessment): boolean {
  return assessment.gates.some((gate) => gate.gateId === 'negative_only' && !gate.passed);
}

function hasWeakSignalGateFailure(assessment: RelevanceAssessment): boolean {
  return assessment.gates.some((gate) => gate.gateId === 'weak_signal_independent' && !gate.passed);
}

/** Derives a disposition tag from the relevance assessment's decision and failed gates. */
export function deriveGraylistDisposition(
  candidate: DiscoveryCandidateRecord,
  assessment: RelevanceAssessment,
): GraylistDisposition {
  if (candidate.status === 'merged' || assessment.isDuplicate) {
    return 'duplicate_of_included';
  }
  if (hasNegativeOnlyGateFailure(assessment)) {
    return 'negative_only_signal';
  }
  if (hasWeakSignalGateFailure(assessment)) {
    return 'weak_signal_uncorroborated';
  }
  if (assessment.decision === 'supporting_context') {
    return 'awaiting_corroboration';
  }
  return 'below_threshold';
}

/** Normalizes a candidate's title (falling back to its stable identifier) into a lookup key. */
export function corroborationKeyFor(candidate: DiscoveryCandidateRecord): string {
  const basis = candidate.adapterRecord.title ?? candidate.identity.stableIdentifier;
  return basis
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function buildGraylistEntry(
  candidate: DiscoveryCandidateRecord,
  assessment: RelevanceAssessment,
  now: string,
): GraylistEntry {
  return {
    schemaVersion: GRAYLIST_SCHEMA_VERSION,
    id: `graylist_${candidate.id}`,
    candidateId: candidate.id,
    identityKey: candidate.identity.identityKey,
    adapterId: candidate.adapterRecord.provenance.adapterId,
    ...(candidate.adapterRecord.classification !== undefined
      ? { sourceClassification: candidate.adapterRecord.classification }
      : {}),
    disposition: deriveGraylistDisposition(candidate, assessment),
    reason: assessment.exclusionReason ?? assessment.whyThisAppears,
    corroborationKey: corroborationKeyFor(candidate),
    compositeScore: assessment.compositeScore,
    status: 'parked',
    parkedAt: now,
    updatedAt: now,
  };
}

/**
 * Parks a below-threshold candidate. Never silently drops it — `shouldPark` gates the caller,
 * and this function itself throws rather than parking a candidate that already reached
 * `include` (parking an included candidate would be a bug in the caller, not a valid state).
 */
export function parkCandidate(
  store: GraylistStore,
  candidate: DiscoveryCandidateRecord,
  assessment: RelevanceAssessment,
  now: string,
): GraylistEntry {
  if (!shouldPark(assessment)) {
    throw new Error(
      `Candidate ${candidate.id} passed relevance (decision=include) and must not be parked to the graylist`,
    );
  }
  const entry = buildGraylistEntry(candidate, assessment, now);
  store.save(entry);
  return entry;
}

/** Queryable-for-corroboration lookup: exact match on the normalized key. */
export function queryGraylistByCorroborationKey(store: GraylistStore, key: string): readonly GraylistEntry[] {
  const normalized = key
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return store.list().filter((entry) => entry.corroborationKey === normalized && entry.status !== 'archived');
}

export function listGraylistByDisposition(
  store: GraylistStore,
  disposition: GraylistDisposition,
): readonly GraylistEntry[] {
  return store.list().filter((entry) => entry.disposition === disposition);
}

/**
 * Marks a parked entry as promoted when new corroborating evidence arrives. This does NOT
 * publish or re-run relevance itself — "crowdsourced items seed research cases, they never
 * publish" (BB-073) — it only flags the entry for the ordinary review pipeline to pick back up.
 */
export function promoteGraylistEntry(
  store: GraylistStore,
  id: string,
  input: { readonly promotedBy: string; readonly reason: string; readonly now: string },
): GraylistEntry {
  const existing = store.get(id);
  if (!existing) {
    throw new Error(`Graylist entry not found: ${id}`);
  }
  if (existing.status === 'promoted') {
    throw new Error(`Graylist entry already promoted: ${id}`);
  }
  if (!input.reason.trim()) {
    throw new Error('A reason is required to promote a graylist entry');
  }
  const updated: GraylistEntry = {
    ...existing,
    status: 'promoted',
    promotedAt: input.now,
    promotedBy: input.promotedBy,
    promotionReason: input.reason,
    updatedAt: input.now,
  };
  store.save(updated);
  return updated;
}

export function archiveGraylistEntry(store: GraylistStore, id: string, now: string): GraylistEntry {
  const existing = store.get(id);
  if (!existing) {
    throw new Error(`Graylist entry not found: ${id}`);
  }
  const updated: GraylistEntry = { ...existing, status: 'archived', updatedAt: now };
  store.save(updated);
  return updated;
}
