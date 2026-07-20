/**
 * Adapts the hand-authored seed catalog (`../../data/public-seed.ts`) into
 * `@repo/domain`'s search-index shape, so the real search pipeline
 * (`runPublicSearch`) has something to query today. This is the same "snapshot" posture as
 * `resolvePublicEntity`: a `liveFetch`-shaped seam exists so a later live Firestore
 * `publicSearchIndex` reader can plug in without changing the search route/page
 * contract — see `getSnapshotSearchIndex` below.
 *
 * `notabilityBasis` synthesis: the bundled seed catalog often carries hand-authored
 * `notabilityLabels` (display strings), not always a structured `NotabilityBasisRecord` from
 * `buildReleaseEntityArtifacts`. When a seed entity DOES carry a real `notabilityBasis`, this
 * adapter uses it (filling empty `evidenceIds` from cited claims). Otherwise it reverse-maps each
 * label to its rubric criterion and attaches the entity's cited claim ids so search and public
 * surfaces share citation-backed inclusion evidence — never empty-evidence theater.
 */
import {
  NOTABILITY_RUBRIC,
  buildPublicSearchIndexDocs,
  formatClaimInclusionNote,
  type NotabilityBasisRecord,
  type NotabilityCriterion,
  type PublicSearchIndexDoc,
  type SearchableEntityRecord,
} from '@repo/domain';
import { listPublicEntities, type PublicEntityView } from '../../data/public-seed';

const RUBRIC_ENTRIES = Object.entries(NOTABILITY_RUBRIC) as readonly [NotabilityCriterion, string][];

function criterionForLabel(label: string): NotabilityCriterion {
  const match = RUBRIC_ENTRIES.find(([, text]) => text === label);
  return match ? match[0] : 'documented_site';
}

function citedClaimIds(entity: PublicEntityView): readonly string[] {
  return entity.claims
    .filter((claim) => claim.citationSource.trim().length > 0)
    .map((claim) => claim.id);
}

function noteFromCitedClaims(entity: PublicEntityView): string {
  const cited = entity.claims.filter((claim) => claim.citationSource.trim().length > 0);
  if (cited.length === 0) {
    return 'Inclusion is pending linked source citations.';
  }
  const [first] = cited;
  return formatClaimInclusionNote(first!.predicate, first!.object);
}

function synthesizeNotabilityBasis(entity: PublicEntityView): readonly NotabilityBasisRecord[] {
  const evidenceIds = citedClaimIds(entity);
  const note = noteFromCitedClaims(entity);
  const labels = entity.notabilityLabels ?? [];
  if (labels.length === 0) {
    return evidenceIds.length === 0
      ? []
      : [{ criterion: 'documented_site', note, evidenceIds }];
  }
  return labels.map((label) => ({
    criterion: criterionForLabel(label),
    note,
    evidenceIds,
  }));
}

/** Real notabilityBasis when present; otherwise citation-backed label synthesis. */
function notabilityBasisFor(entity: PublicEntityView): readonly NotabilityBasisRecord[] {
  if (entity.notabilityBasis && entity.notabilityBasis.length > 0) {
    const citedIds = citedClaimIds(entity);
    const fallbackNote = noteFromCitedClaims(entity);
    const byId = new Map(entity.claims.map((claim) => [claim.id, claim] as const));
    return entity.notabilityBasis.map((record) => {
      const evidenceIds = record.evidenceIds.length > 0 ? record.evidenceIds : citedIds;
      const linked = evidenceIds.map((id) => byId.get(id)).find((claim) => claim !== undefined);
      const note =
        record.note.trim() === NOTABILITY_RUBRIC[record.criterion].trim()
          ? fallbackNote
          : linked
            ? formatClaimInclusionNote(linked.predicate, linked.object)
            : record.note;
      return {
        criterion: record.criterion,
        note,
        evidenceIds,
      };
    });
  }
  return synthesizeNotabilityBasis(entity);
}

function toSearchableRecord(entity: PublicEntityView): SearchableEntityRecord {
  return {
    id: entity.id,
    kind: entity.kind,
    displayName: entity.displayName,
    nameLower: entity.displayName.toLowerCase(),
    // The seed catalog has no EntityAlias data yet no fixture entity has recorded aliases.
    aliases: [],
    ...(entity.summary !== undefined ? { summary: entity.summary } : {}),
    topicTags: entity.topicTags,
    jurisdictionState: entity.jurisdictionLabel,
    ...(entity.status !== undefined ? { status: entity.status } : {}),
    eraBuckets: entity.eraBuckets ?? [],
    notabilityBasis: notabilityBasisFor(entity),
    notabilityLabels: entity.notabilityLabels ?? [],
    ...(entity.sensitivityClass !== undefined ? { sensitivityClass: entity.sensitivityClass } : {}),
    recordMaturity: entity.recordMaturity,
    researchCoverage: entity.researchCoverage,
    relatedCount: entity.related?.length ?? entity.relatedIds.length,
    claimCount: entity.claims.length,
  };
}

const SNAPSHOT_RELEASE_ID = 'seed-snapshot';

let cachedIndex: readonly PublicSearchIndexDoc[] | undefined;

/**
 * Builds (and memoizes) the search index from the bundled seed catalog. Any fixture missing a
 * notability basis is skipped by the real notability gate, not silently included — see
 * `buildPublicSearchIndexDocs`. Call `resetSnapshotSearchIndexCache` in tests that mutate
 * process state the gate depends on.
 */
export function getSnapshotSearchIndex(): readonly PublicSearchIndexDoc[] {
  if (!cachedIndex) {
    const records = listPublicEntities().map(toSearchableRecord);
    const { docs } = buildPublicSearchIndexDocs(SNAPSHOT_RELEASE_ID, records);
    cachedIndex = docs;
  }
  return cachedIndex;
}

export function resetSnapshotSearchIndexCache(): void {
  cachedIndex = undefined;
}
