/**
 * Adapts the hand-authored seed catalog (`../../data/public-seed.ts`) into
 * `@blap/domain`'s search-index shape, so the real search pipeline
 * (`runPublicSearch`) has something to query today. This is the same "snapshot" posture as
 * `resolvePublicEntity`: a `liveFetch`-shaped seam exists so a later live Firestore
 * `publicSearchIndex` reader can plug in without changing the search route/page
 * contract — see `getSnapshotSearchIndex` below.
 *
 * `notabilityBasis` synthesis: the bundled seed catalog only carries hand-authored
 * `notabilityLabels` (display strings), not the structured `NotabilityBasisRecord` a release
 * built by `@blap/domain`'s `buildReleaseEntityArtifacts` carries (black-book-1fg9). When a
 * seed entity DOES carry a real `notabilityBasis` (`PublicEntityView.notabilityBasis`), this
 * adapter uses it as-is — no synthesis, real `evidenceIds`. Otherwise the notability gate must
 * still run at the search boundary regardless of data source, so this adapter reverse-maps each
 * label back to its rubric criterion (exact string match against `NOTABILITY_RUBRIC`) so the
 * real gate — not a bypass — is what lets these fixtures into the index. A label with no exact
 * rubric match falls back to `documented_site` (the broadest criterion) rather than being
 * dropped, since seed fixtures are known-good by construction. The synthesized `evidenceIds` is
 * empty (the bundled seed catalog has no evidence-record ids to cite): that means "no structured
 * evidence-id linkage recorded", not "zero evidence exists". Callers must not render
 * `evidenceIds.length` as a documented-source count for these records (see `WhyThisAppears`,
 * which hides the count when it's empty).
 */
import {
  NOTABILITY_RUBRIC,
  buildPublicSearchIndexDocs,
  type NotabilityBasisRecord,
  type NotabilityCriterion,
  type PublicSearchIndexDoc,
  type SearchableEntityRecord,
} from '@blap/domain';
import { listPublicEntities, type PublicEntityView } from '../../data/public-seed';

const RUBRIC_ENTRIES = Object.entries(NOTABILITY_RUBRIC) as readonly [NotabilityCriterion, string][];

function criterionForLabel(label: string): NotabilityCriterion {
  const match = RUBRIC_ENTRIES.find(([, text]) => text === label);
  return match ? match[0] : 'documented_site';
}

function synthesizeNotabilityBasis(
  labels: readonly string[] | undefined,
): readonly NotabilityBasisRecord[] {
  return (labels ?? []).map((note) => ({
    criterion: criterionForLabel(note),
    note,
    evidenceIds: [],
  }));
}

/** Real notabilityBasis when the entity carries one (black-book-1fg9 release builder output);
 * otherwise the label-synthesis fallback above for pre-builder seed fixtures. */
function notabilityBasisFor(entity: PublicEntityView): readonly NotabilityBasisRecord[] {
  if (entity.notabilityBasis && entity.notabilityBasis.length > 0) {
    return entity.notabilityBasis;
  }
  return synthesizeNotabilityBasis(entity.notabilityLabels);
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
