/**
 * Sybil / source-independence integrity signals (BB-089).
 *
 * A coordinated network of look-alike blogs/mirrors can manufacture the *appearance* of
 * independent corroboration even though every "source" traces back to one actor. This module
 * adds detection for that pattern on top of the BB-017 confidence engine, without duplicating
 * its scoring math:
 *
 * - Strong evidence of common control (shared RDAP registrant, shared ASN, or an overlapping
 *   nameserver set across otherwise-distinct lineage roots) collapses those lineage roots onto
 *   one canonical id *before* handing evidence links to {@link recalculateConfidence}. The
 *   existing syndicated-copy dedupe in `../claims/confidence.ts`
 *   (`uniqueLineageAggregates` / `lineageIndependenceFromCount`, reached via
 *   {@link recalculateConfidence}) then does the actual discounting — this module never
 *   recomputes score weights itself.
 * - Weaker, timing-only correlation (co-registration within a short window, a freshly
 *   first-seen domain, near-simultaneous publication) is surfaced as an advisory
 *   {@link SybilAdvisorySignals.independenceDiscount} for reviewer attention. It is recorded on
 *   the result but never silently changes the score — coincidental timing alone is not proof of
 *   common control.
 * - A new hard gate requires at least one top-tier source (archival, government-record, or
 *   peer-reviewed) among the surviving independent lineages before a claim can pass publication,
 *   regardless of how many lower-trust sources corroborate it. This ANDs with the existing
 *   `passesPublishThreshold`; it does not replace it.
 *
 * All inputs here are optional and additive: callers that never supply
 * {@link SourceIndependenceMetadata} get byte-identical behavior to plain
 * {@link recalculateConfidence}.
 *
 * Test coverage: `./sybil-signals.test.ts` in this directory, plus five narrative-level Sybil
 * fixtures added to the BB-047 gold corpus (`packages/testing/src/gold-corpus/fixtures/
 * gold-corpus.v1.json`, ids `gc-121`–`gc-125`, category `source_lineage`) exercising shared-
 * registrant collapse, shared-ASN/nameserver collapse, advisory-only timing signals, and the
 * top-tier-source gate, plus a positive control showing genuine corroboration still publishes.
 * BB-060 (adversarial integrity exercise) does not exist as a bead yet — wiring these signals
 * into a live adversarial-exercise harness is a forward reference for whenever BB-060 is created,
 * not something this module or its fixtures do today.
 */
import type { ClaimEvidenceLink } from '../claims/index.js';
import {
  recalculateConfidence,
  type AuditedConfidenceResult,
  type RecalculateConfidenceInput,
} from './engine.js';

export const SYBIL_SIGNALS_VERSION = 'sybil-signals.v1' as const;

/**
 * Per-lineage registration/publication metadata an adapter may attach for Sybil detection.
 * Reuses data adapters already fetch (RDAP/WHOIS lookups, HTTP response timing) — this module
 * does not perform any network I/O itself.
 */
export type SourceIndependenceMetadata = {
  readonly lineageRootId: string;
  readonly evidenceId: string;
  /** Registered domain this evidence was published under, if web-sourced. */
  readonly domain?: string;
  /** Salted/hashed RDAP registrant identity. Never raw registrant PII. */
  readonly rdapRegistrantHash?: string;
  readonly asn?: string;
  readonly nameservers?: readonly string[];
  /** ISO date the domain's registration became effective (WHOIS/RDAP createdDate). */
  readonly domainRegisteredAt?: string;
  /** ISO date Black Book first observed this domain as a source, independent of registration date. */
  readonly domainFirstSeenAt?: string;
  /** ISO datetime this specific evidence item was published. */
  readonly publishedAt?: string;
};

/** Archive/academic/government-of-record tiers — the only classifications that satisfy the
 *  top-tier publication gate. Deliberately excludes `news_reportage`: the current
 *  `sourceClassification` model (see `../claims/confidence.ts`) does not yet distinguish a
 *  newspaper-of-record from a tabloid, so treating all news reportage as top-tier would be
 *  unsound. Refining that distinction is a forward reference for a future classification bead,
 *  not solved here. */
export const TOP_TIER_SOURCE_CLASSIFICATIONS = [
  'primary_archival',
  'government_record',
  'peer_reviewed',
] as const;
export type TopTierSourceClassification = (typeof TOP_TIER_SOURCE_CLASSIFICATIONS)[number];

export function isTopTierSourceClassification(classification: string): boolean {
  return (TOP_TIER_SOURCE_CLASSIFICATIONS as readonly string[]).includes(classification);
}

const CO_REGISTRATION_WINDOW_DAYS_DEFAULT = 30;
const NEAR_SIMULTANEOUS_PUBLICATION_WINDOW_HOURS_DEFAULT = 72;
const FIRST_SEEN_RECENCY_WINDOW_DAYS_DEFAULT = 90;

const CO_REGISTRATION_DISCOUNT_PER_PAIR = 0.1;
const NEAR_SIMULTANEOUS_PUBLICATION_DISCOUNT_PER_PAIR = 0.1;
const RECENT_FIRST_SEEN_DISCOUNT = 0.1;
const MAX_ADVISORY_INDEPENDENCE_DISCOUNT = 0.6;

export type SharedInfrastructureKind = 'shared_registrant' | 'shared_asn' | 'shared_nameserver';

export type SharedInfrastructureFinding = {
  readonly kind: SharedInfrastructureKind;
  readonly lineageRootIds: readonly [string, string];
  readonly sharedValue: string;
};

export type CoRegistrationFinding = {
  readonly lineageRootIds: readonly [string, string];
  readonly daysApart: number;
};

export type NearSimultaneousPublicationFinding = {
  readonly lineageRootIds: readonly [string, string];
  readonly hoursApart: number;
};

export type RecentFirstSeenFinding = {
  readonly lineageRootId: string;
  readonly domainFirstSeenAt: string;
  readonly daysBeforeReference: number;
};

export type SharedInfrastructureCluster = {
  /** Lexicographically-lowest lineageRootId in the cluster; used as the collapse target. */
  readonly canonicalLineageRootId: string;
  readonly lineageRootIds: readonly string[];
};

export type SybilAdvisorySignals = {
  readonly coRegistration: readonly CoRegistrationFinding[];
  readonly nearSimultaneousPublication: readonly NearSimultaneousPublicationFinding[];
  readonly recentFirstSeen: readonly RecentFirstSeenFinding[];
  /** [0,1] advisory-only score for reviewer attention; never silently applied to the score. */
  readonly independenceDiscount: number;
};

export type SourceIndependenceAssessment = {
  readonly signalsVersion: typeof SYBIL_SIGNALS_VERSION;
  readonly sharedInfrastructureFindings: readonly SharedInfrastructureFinding[];
  readonly sharedInfrastructureClusters: readonly SharedInfrastructureCluster[];
  readonly advisory: SybilAdvisorySignals;
  readonly evaluatedAt: string;
};

export type TopTierSourceGate = {
  readonly topTierSourcePresent: boolean;
  readonly topTierLineageRootIds: readonly string[];
};

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function daysBetween(a: string, b: string): number {
  return Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;
}

function hoursBetween(a: string, b: string): number {
  return Math.abs(Date.parse(a) - Date.parse(b)) / 3_600_000;
}

/** One row per lineage root (first wins) so a lineage's own syndicated copies never produce
 *  findings against themselves. */
function oneRowPerLineage(
  metadata: readonly SourceIndependenceMetadata[],
): readonly SourceIndependenceMetadata[] {
  const byLineage = new Map<string, SourceIndependenceMetadata>();
  for (const row of metadata) {
    if (!byLineage.has(row.lineageRootId)) {
      byLineage.set(row.lineageRootId, row);
    }
  }
  return [...byLineage.values()].sort((a, b) => a.lineageRootId.localeCompare(b.lineageRootId));
}

function pairKey(a: string, b: string): readonly [string, string] {
  return a.localeCompare(b) <= 0 ? [a, b] : [b, a];
}

/** Minimal union-find so transitive sharing (A~B via ns1, B~C via ns2) still forms one cluster. */
function createUnionFind(ids: readonly string[]) {
  const parent = new Map<string, string>(ids.map((id) => [id, id]));
  function find(id: string): string {
    let root = id;
    while (parent.get(root) !== root) {
      root = parent.get(root)!;
    }
    let cursor = id;
    while (parent.get(cursor) !== root) {
      const next = parent.get(cursor)!;
      parent.set(cursor, root);
      cursor = next;
    }
    return root;
  }
  function union(a: string, b: string): void {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent.set(rootA, rootB);
    }
  }
  return { find, union };
}

function findSharedValueFindings(
  rows: readonly SourceIndependenceMetadata[],
  field: 'rdapRegistrantHash' | 'asn',
  kind: SharedInfrastructureKind,
): SharedInfrastructureFinding[] {
  const byValue = new Map<string, string[]>();
  for (const row of rows) {
    const value = row[field];
    if (!value) continue;
    const existing = byValue.get(value);
    if (existing) {
      existing.push(row.lineageRootId);
    } else {
      byValue.set(value, [row.lineageRootId]);
    }
  }
  const findings: SharedInfrastructureFinding[] = [];
  for (const [value, lineageRootIds] of byValue) {
    const sorted = [...new Set(lineageRootIds)].sort();
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        findings.push({ kind, lineageRootIds: pairKey(sorted[i]!, sorted[j]!), sharedValue: value });
      }
    }
  }
  return findings;
}

function findSharedNameserverFindings(
  rows: readonly SourceIndependenceMetadata[],
): SharedInfrastructureFinding[] {
  const byNameserver = new Map<string, string[]>();
  for (const row of rows) {
    for (const nameserver of row.nameservers ?? []) {
      const existing = byNameserver.get(nameserver);
      if (existing) {
        existing.push(row.lineageRootId);
      } else {
        byNameserver.set(nameserver, [row.lineageRootId]);
      }
    }
  }
  const findings: SharedInfrastructureFinding[] = [];
  for (const [nameserver, lineageRootIds] of byNameserver) {
    const sorted = [...new Set(lineageRootIds)].sort();
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        findings.push({
          kind: 'shared_nameserver',
          lineageRootIds: pairKey(sorted[i]!, sorted[j]!),
          sharedValue: nameserver,
        });
      }
    }
  }
  return findings;
}

/**
 * Detects strong shared-infrastructure evidence (registrant / ASN / nameserver overlap) and
 * groups the affected lineage roots into clusters via union-find so transitive sharing still
 * collapses to one cluster. Only lineage roots that actually share infrastructure are grouped;
 * everything else stays independent.
 */
export function detectSharedInfrastructureClusters(
  metadata: readonly SourceIndependenceMetadata[],
): {
  readonly findings: readonly SharedInfrastructureFinding[];
  readonly clusters: readonly SharedInfrastructureCluster[];
} {
  const rows = oneRowPerLineage(metadata);
  const findings = [
    ...findSharedValueFindings(rows, 'rdapRegistrantHash', 'shared_registrant'),
    ...findSharedValueFindings(rows, 'asn', 'shared_asn'),
    ...findSharedNameserverFindings(rows),
  ].sort(
    (a, b) =>
      a.lineageRootIds[0].localeCompare(b.lineageRootIds[0]) ||
      a.lineageRootIds[1].localeCompare(b.lineageRootIds[1]) ||
      a.kind.localeCompare(b.kind),
  );

  const uf = createUnionFind(rows.map((row) => row.lineageRootId));
  for (const finding of findings) {
    uf.union(finding.lineageRootIds[0], finding.lineageRootIds[1]);
  }

  const grouped = new Map<string, Set<string>>();
  for (const row of rows) {
    const root = uf.find(row.lineageRootId);
    const existing = grouped.get(root);
    if (existing) {
      existing.add(row.lineageRootId);
    } else {
      grouped.set(root, new Set([row.lineageRootId]));
    }
  }

  const clusters: SharedInfrastructureCluster[] = [...grouped.values()]
    .filter((members) => members.size > 1)
    .map((members) => {
      const sorted = [...members].sort();
      return { canonicalLineageRootId: sorted[0]!, lineageRootIds: sorted };
    })
    .sort((a, b) => a.canonicalLineageRootId.localeCompare(b.canonicalLineageRootId));

  return { findings, clusters };
}

/**
 * Rewrites evidence links so every lineage root inside a shared-infrastructure cluster maps to
 * the cluster's canonical id. Returns new link objects; never mutates the input. Feeding the
 * result into {@link recalculateConfidence} reuses the existing syndicated-copy dedupe
 * (`uniqueLineageAggregates`) so a Sybil cluster is discounted exactly like syndicated wire
 * copies are today — one independent source, not N.
 */
export function collapseSharedInfrastructureLineages(
  links: readonly ClaimEvidenceLink[],
  clusters: readonly SharedInfrastructureCluster[],
): ClaimEvidenceLink[] {
  const canonicalFor = new Map<string, string>();
  for (const cluster of clusters) {
    for (const lineageRootId of cluster.lineageRootIds) {
      canonicalFor.set(lineageRootId, cluster.canonicalLineageRootId);
    }
  }
  if (canonicalFor.size === 0) {
    return [...links];
  }
  return links.map((link) => {
    const canonical = canonicalFor.get(link.lineageRootId);
    return canonical === undefined || canonical === link.lineageRootId
      ? link
      : { ...link, lineageRootId: canonical };
  });
}

/**
 * Weaker, timing-only correlation signals. Recorded for reviewer attention as an advisory
 * discount; deliberately never applied to the confidence score automatically, since coincidental
 * timing alone is not proof of common control.
 */
export function assessAdvisorySignals(input: {
  readonly metadata: readonly SourceIndependenceMetadata[];
  readonly referenceDate: string;
  readonly coRegistrationWindowDays?: number;
  readonly nearSimultaneousPublicationWindowHours?: number;
  readonly firstSeenRecencyWindowDays?: number;
}): SybilAdvisorySignals {
  const coRegistrationWindowDays =
    input.coRegistrationWindowDays ?? CO_REGISTRATION_WINDOW_DAYS_DEFAULT;
  const nearSimultaneousPublicationWindowHours =
    input.nearSimultaneousPublicationWindowHours ??
    NEAR_SIMULTANEOUS_PUBLICATION_WINDOW_HOURS_DEFAULT;
  const firstSeenRecencyWindowDays =
    input.firstSeenRecencyWindowDays ?? FIRST_SEEN_RECENCY_WINDOW_DAYS_DEFAULT;

  const rows = oneRowPerLineage(input.metadata);
  const coRegistration: CoRegistrationFinding[] = [];
  const nearSimultaneousPublication: NearSimultaneousPublicationFinding[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const a = rows[i]!;
      const b = rows[j]!;
      if (a.domainRegisteredAt && b.domainRegisteredAt) {
        const days = daysBetween(a.domainRegisteredAt, b.domainRegisteredAt);
        if (days <= coRegistrationWindowDays) {
          coRegistration.push({
            lineageRootIds: pairKey(a.lineageRootId, b.lineageRootId),
            daysApart: round2(days),
          });
        }
      }
      if (a.publishedAt && b.publishedAt) {
        const hours = hoursBetween(a.publishedAt, b.publishedAt);
        if (hours <= nearSimultaneousPublicationWindowHours) {
          nearSimultaneousPublication.push({
            lineageRootIds: pairKey(a.lineageRootId, b.lineageRootId),
            hoursApart: round2(hours),
          });
        }
      }
    }
  }

  const recentFirstSeen: RecentFirstSeenFinding[] = rows
    .filter((row) => row.domainFirstSeenAt !== undefined)
    .map((row) => ({
      lineageRootId: row.lineageRootId,
      domainFirstSeenAt: row.domainFirstSeenAt!,
      daysBeforeReference: round2(daysBetween(row.domainFirstSeenAt!, input.referenceDate)),
    }))
    .filter((finding) => finding.daysBeforeReference <= firstSeenRecencyWindowDays)
    .sort((a, b) => a.lineageRootId.localeCompare(b.lineageRootId));

  const rawDiscount =
    coRegistration.length * CO_REGISTRATION_DISCOUNT_PER_PAIR +
    nearSimultaneousPublication.length * NEAR_SIMULTANEOUS_PUBLICATION_DISCOUNT_PER_PAIR +
    (recentFirstSeen.length > 0 ? RECENT_FIRST_SEEN_DISCOUNT : 0);

  return {
    coRegistration,
    nearSimultaneousPublication,
    recentFirstSeen,
    independenceDiscount: round4(Math.min(MAX_ADVISORY_INDEPENDENCE_DISCOUNT, clamp01(rawDiscount))),
  };
}

/** Full source-independence assessment: strong shared-infrastructure findings/clusters plus the
 *  weaker advisory signals, versioned for audit trails. */
export function assessSourceIndependence(input: {
  readonly metadata: readonly SourceIndependenceMetadata[];
  readonly referenceDate: string;
  readonly coRegistrationWindowDays?: number;
  readonly nearSimultaneousPublicationWindowHours?: number;
  readonly firstSeenRecencyWindowDays?: number;
}): SourceIndependenceAssessment {
  const { findings, clusters } = detectSharedInfrastructureClusters(input.metadata);
  const advisory = assessAdvisorySignals(input);
  return {
    signalsVersion: SYBIL_SIGNALS_VERSION,
    sharedInfrastructureFindings: findings,
    sharedInfrastructureClusters: clusters,
    advisory,
    evaluatedAt: input.referenceDate,
  };
}

/**
 * At least one top-tier (archival / government-record / peer-reviewed) supporting, credible
 * lineage is required before a claim can reach published confidence — low-trust corroboration
 * alone, however numerous, never publishes on its own.
 */
export function evaluateTopTierSourceGate(
  evidenceLinks: readonly ClaimEvidenceLink[],
): TopTierSourceGate {
  const topTierLineageRootIds = [
    ...new Set(
      evidenceLinks
        .filter(
          (link) =>
            link.role === 'supporting' &&
            link.credible &&
            isTopTierSourceClassification(link.sourceClassification),
        )
        .map((link) => link.lineageRootId),
    ),
  ].sort();
  return {
    topTierSourcePresent: topTierLineageRootIds.length > 0,
    topTierLineageRootIds,
  };
}

export type SybilAwareConfidenceResult = AuditedConfidenceResult & {
  readonly sourceIndependence: SourceIndependenceAssessment;
  readonly topTier: TopTierSourceGate;
  /** AND of the base engine's threshold result and the top-tier-source gate. The shared-
   *  infrastructure discount already reached `passesPublishThreshold` upstream, by collapsing
   *  Sybil-clustered lineages before scoring — it is not reapplied here. */
  readonly passesPublishThreshold: boolean;
};

/**
 * Sybil-aware wrapper around {@link recalculateConfidence}. Collapses any detected
 * shared-infrastructure lineage clusters before scoring (so the existing lineage-independence
 * math discounts them exactly like syndicated copies), then ANDs the result with the top-tier
 * source gate. Advisory timing-only signals are attached to the result for reviewers but never
 * change the score. Omitting `sourceIndependenceMetadata` reproduces
 * {@link recalculateConfidence} exactly, aside from the additional top-tier gate.
 */
export function recalculateConfidenceWithSybilSignals(
  input: RecalculateConfidenceInput & {
    readonly sourceIndependenceMetadata?: readonly SourceIndependenceMetadata[];
    readonly referenceDate?: string;
  },
): SybilAwareConfidenceResult {
  const referenceDate = input.referenceDate ?? input.calculatedAt ?? new Date().toISOString();
  const metadata = input.sourceIndependenceMetadata ?? [];
  const { clusters } = detectSharedInfrastructureClusters(metadata);
  const collapsedLinks = collapseSharedInfrastructureLineages(input.evidenceLinks, clusters);
  const sourceIndependence = assessSourceIndependence({ metadata, referenceDate });
  const topTier = evaluateTopTierSourceGate(collapsedLinks);
  const base = recalculateConfidence({ ...input, evidenceLinks: collapsedLinks });

  return {
    ...base,
    sourceIndependence,
    topTier,
    passesPublishThreshold: base.passesPublishThreshold && topTier.topTierSourcePresent,
  };
}
