/**
 * Pure validation and triage for the DC Black History Sites bulk discovery fixture.
 * Used by dry-run-bulk-dc-sites.ts and unit tests — no network or Firebase I/O.
 */
import {
  buildCatalogMatchIndex,
  classifyLeadAgainstCatalog,
  loadCatalogEntitiesFromFixtures,
  type CatalogMatchIndex,
  type LeadClassification,
} from './catalog-entity-match.ts';

/** Fixture row shape produced by import-bulk-source-programs.ts (dc-sites lane). */
export type BulkDcSiteCandidate = {
  readonly id: string;
  readonly kind: string;
  readonly displayName: string;
  readonly summary: string;
  readonly canonicalUrl: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly researchLaneOnly?: boolean;
  readonly provenance?: {
    readonly sourceId?: string;
    readonly sourceItemId?: string;
    readonly sourceCategory?: string;
    readonly historicAddress?: string;
    readonly rights?: string;
    readonly geoPrecision?: string;
  };
};

export type BulkDcSitesFixture = {
  readonly generatedAt?: string;
  readonly metadata?: {
    readonly sourceProgramId?: string;
    readonly count?: number;
    readonly license?: string;
  };
  readonly candidates: readonly BulkDcSiteCandidate[];
};

export type DcGeoBounds = {
  readonly minLat: number;
  readonly maxLat: number;
  readonly minLng: number;
  readonly maxLng: number;
};

/** Coarse Washington, DC bbox — sufficient for bulk-lane sanity checks, not parcel precision. */
export const DC_BBOX: DcGeoBounds = {
  minLat: 38.79,
  maxLat: 38.995,
  minLng: -77.12,
  maxLng: -76.9,
};

export type TriageDisposition =
  | 'enrichment_ready'
  | 'catalog_enrich'
  | 'geo_hold'
  | 'privacy_review'
  | 'validation_error';

export type CandidateTriageRow = {
  readonly candidateId: string;
  readonly displayName: string;
  readonly sourceCategory: string;
  readonly disposition: TriageDisposition;
  readonly reasons: readonly string[];
  readonly catalog?: LeadClassification;
  readonly lat?: number;
  readonly lng?: number;
  readonly canonicalUrl?: string;
};

export type BulkDcTriageReport = {
  readonly lane: 'dc-sites';
  readonly fixturePath: string;
  readonly generatedAt: string;
  readonly fixtureGeneratedAt?: string;
  readonly bytes: number;
  readonly counts: {
    readonly candidates: number;
    readonly validationErrors: number;
    readonly withGeo: number;
    readonly missingGeo: number;
    readonly inDcBounds: number;
    readonly outOfDcBounds: number;
    readonly peopleCategory: number;
    readonly catalogExistingMatch: number;
    readonly catalogNewCandidate: number;
    readonly catalogNonEntity: number;
    readonly fallbackCatalogUrl: number;
  };
  readonly categories: Readonly<Record<string, number>>;
  readonly urlHosts: Readonly<Record<string, number>>;
  readonly dispositions: Readonly<Record<TriageDisposition, number>>;
  readonly validationIssues: readonly { readonly candidateId: string; readonly issues: readonly string[] }[];
  readonly samples: {
    readonly catalogEnrich: readonly CandidateTriageRow[];
    readonly geoHold: readonly CandidateTriageRow[];
    readonly privacyReview: readonly CandidateTriageRow[];
    readonly enrichmentReady: readonly CandidateTriageRow[];
  };
  readonly firebaseTargetShape: {
    readonly researchCase: Readonly<Record<string, string>>;
    readonly discoveryCandidate: Readonly<Record<string, string>>;
    readonly releaseEntity: Readonly<Record<string, string>>;
    readonly firestorePaths: readonly string[];
  };
};

const FALLBACK_CATALOG_URL = 'https://catalog.data.gov/dataset/black-history-sites-washington';

function isFiniteCoord(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function pointInDcBounds(lat: number, lng: number, bounds: DcGeoBounds = DC_BBOX): boolean {
  return lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng;
}

export function validateBulkDcCandidate(candidate: BulkDcSiteCandidate): readonly string[] {
  const issues: string[] = [];
  if (!candidate.id?.trim()) issues.push('missing id');
  if (candidate.kind !== 'place') issues.push(`expected kind=place, got ${candidate.kind}`);
  if (!candidate.displayName?.trim()) issues.push('missing displayName');
  if (!candidate.summary?.trim()) issues.push('missing summary');
  if (!candidate.canonicalUrl?.trim()) issues.push('missing canonicalUrl');
  if (candidate.researchLaneOnly !== true) issues.push('researchLaneOnly must be true');
  if (candidate.provenance?.sourceId !== 'dc-black-history-sites') {
    issues.push('provenance.sourceId must be dc-black-history-sites');
  }
  if (!candidate.provenance?.sourceItemId?.trim()) issues.push('missing provenance.sourceItemId');
  if (candidate.provenance?.rights !== 'CC BY 4.0') issues.push('expected CC BY 4.0 rights');
  return issues;
}

function triageOneCandidate(input: {
  readonly candidate: BulkDcSiteCandidate;
  readonly catalogIndex: CatalogMatchIndex;
  readonly bounds: DcGeoBounds;
}): CandidateTriageRow {
  const validationIssues = validateBulkDcCandidate(input.candidate);
  const reasons: string[] = [...validationIssues];
  const sourceCategory = input.candidate.provenance?.sourceCategory ?? '(none)';

  if (validationIssues.length > 0) {
    return {
      candidateId: input.candidate.id,
      displayName: input.candidate.displayName,
      sourceCategory,
      disposition: 'validation_error',
      reasons,
      ...(input.candidate.lat !== undefined ? { lat: input.candidate.lat } : {}),
      ...(input.candidate.lng !== undefined ? { lng: input.candidate.lng } : {}),
      canonicalUrl: input.candidate.canonicalUrl,
    };
  }

  const hasGeo =
    isFiniteCoord(input.candidate.lat) && isFiniteCoord(input.candidate.lng);
  if (!hasGeo) {
    reasons.push('missing lat/lng');
    return {
      candidateId: input.candidate.id,
      displayName: input.candidate.displayName,
      sourceCategory,
      disposition: 'geo_hold',
      reasons,
      canonicalUrl: input.candidate.canonicalUrl,
    };
  }

  const lat = input.candidate.lat!;
  const lng = input.candidate.lng!;
  if (!pointInDcBounds(lat, lng, input.bounds)) {
    reasons.push('coordinates outside DC bbox');
    return {
      candidateId: input.candidate.id,
      displayName: input.candidate.displayName,
      sourceCategory,
      disposition: 'geo_hold',
      reasons,
      lat,
      lng,
      canonicalUrl: input.candidate.canonicalUrl,
    };
  }

  const catalog = classifyLeadAgainstCatalog({
    title: input.candidate.displayName,
    summary: input.candidate.summary,
    index: input.catalogIndex,
  });

  if (catalog.kind === 'existing_match') {
    reasons.push(`catalog match → ${catalog.matchedEntityId}`);
    return {
      candidateId: input.candidate.id,
      displayName: input.candidate.displayName,
      sourceCategory,
      disposition: 'catalog_enrich',
      reasons,
      catalog,
      lat,
      lng,
      canonicalUrl: input.candidate.canonicalUrl,
    };
  }

  if (sourceCategory === 'People') {
    reasons.push('People-typed site — privacy/living-status review before any public pin');
    return {
      candidateId: input.candidate.id,
      displayName: input.candidate.displayName,
      sourceCategory,
      disposition: 'privacy_review',
      reasons,
      catalog,
      lat,
      lng,
      canonicalUrl: input.candidate.canonicalUrl,
    };
  }

  if (input.candidate.canonicalUrl === FALLBACK_CATALOG_URL) {
    reasons.push('canonicalUrl is data.gov fallback — prefer historicsites.dcpreservation.org item page');
  }

  return {
    candidateId: input.candidate.id,
    displayName: input.candidate.displayName,
    sourceCategory,
    disposition: 'enrichment_ready',
    reasons,
    catalog,
    lat,
    lng,
    canonicalUrl: input.candidate.canonicalUrl,
  };
}

export function triageBulkDcSitesFixture(input: {
  readonly fixture: BulkDcSitesFixture;
  readonly fixturePath: string;
  readonly bytes: number;
  readonly catalogIndex: CatalogMatchIndex;
  readonly bounds?: DcGeoBounds;
  readonly now?: string;
  readonly sampleSize?: number;
}): BulkDcTriageReport {
  const bounds = input.bounds ?? DC_BBOX;
  const sampleSize = input.sampleSize ?? 5;
  const rows = input.fixture.candidates.map((candidate) =>
    triageOneCandidate({ candidate, catalogIndex: input.catalogIndex, bounds }),
  );

  const categories: Record<string, number> = {};
  const urlHosts: Record<string, number> = {};
  const dispositions: Record<TriageDisposition, number> = {
    enrichment_ready: 0,
    catalog_enrich: 0,
    geo_hold: 0,
    privacy_review: 0,
    validation_error: 0,
  };

  let withGeo = 0;
  let missingGeo = 0;
  let inDcBounds = 0;
  let outOfDcBounds = 0;
  let peopleCategory = 0;
  let catalogExistingMatch = 0;
  let catalogNewCandidate = 0;
  let catalogNonEntity = 0;
  let fallbackCatalogUrl = 0;
  const validationIssues: Array<{ candidateId: string; issues: readonly string[] }> = [];

  for (const candidate of input.fixture.candidates) {
    const cat = candidate.provenance?.sourceCategory ?? '(none)';
    categories[cat] = (categories[cat] ?? 0) + 1;
    if (cat === 'People') peopleCategory += 1;
    if (candidate.canonicalUrl === FALLBACK_CATALOG_URL) fallbackCatalogUrl += 1;
    try {
      const host = new URL(candidate.canonicalUrl).hostname;
      urlHosts[host] = (urlHosts[host] ?? 0) + 1;
    } catch {
      urlHosts['(invalid)'] = (urlHosts['(invalid)'] ?? 0) + 1;
    }
    const hasGeo = isFiniteCoord(candidate.lat) && isFiniteCoord(candidate.lng);
    if (hasGeo) {
      withGeo += 1;
      if (pointInDcBounds(candidate.lat!, candidate.lng!, bounds)) inDcBounds += 1;
      else outOfDcBounds += 1;
    } else {
      missingGeo += 1;
    }
  }

  for (const row of rows) {
    dispositions[row.disposition] += 1;
    if (row.disposition === 'validation_error') {
      validationIssues.push({ candidateId: row.candidateId, issues: row.reasons });
    }
    const catalogKind = row.catalog?.kind;
    if (catalogKind === 'existing_match') catalogExistingMatch += 1;
    else if (catalogKind === 'new_candidate') catalogNewCandidate += 1;
    else if (catalogKind === 'non_entity') catalogNonEntity += 1;
  }

  const byDisposition = (kind: TriageDisposition): CandidateTriageRow[] =>
    rows.filter((row) => row.disposition === kind).slice(0, sampleSize);

  return {
    lane: 'dc-sites',
    fixturePath: input.fixturePath,
    generatedAt: input.now ?? new Date().toISOString(),
    ...(input.fixture.generatedAt ? { fixtureGeneratedAt: input.fixture.generatedAt } : {}),
    bytes: input.bytes,
    counts: {
      candidates: input.fixture.candidates.length,
      validationErrors: dispositions.validation_error,
      withGeo,
      missingGeo,
      inDcBounds,
      outOfDcBounds,
      peopleCategory,
      catalogExistingMatch,
      catalogNewCandidate,
      catalogNonEntity,
      fallbackCatalogUrl,
    },
    categories,
    urlHosts,
    dispositions,
    validationIssues,
    samples: {
      catalogEnrich: byDisposition('catalog_enrich'),
      geoHold: byDisposition('geo_hold'),
      privacyReview: byDisposition('privacy_review'),
      enrichmentReady: byDisposition('enrichment_ready'),
    },
    firebaseTargetShape: {
      researchCase: {
        collection: 'researchCases',
        state: 'candidate → relevance_review → … → promote (human-gated)',
        adapterId: 'bulk-dc-black-history-sites',
        sourceProgramId: 'dc-black-history-sites',
      },
      discoveryCandidate: {
        schemaVersion: 'discovery-candidate.v1',
        ingestMode: 'bulk',
        status: 'pending',
        note: 'Produced by ingestBulkCandidates after adapter-record mapping — never public',
      },
      releaseEntity: {
        schema: 'ReleaseSourceEntity (@repo/domain publication/release-builder.ts)',
        required: 'id, kind, displayName, summary, jurisdictionLabel, locationPrecision, locationLabel, lat, lng, claims[]',
        publishPath: 'fixtures/national-catalog/*.json → publish-national-catalog.ts',
      },
      firestorePaths: [
        'researchCases/{caseId}',
        'publicReleases/{releaseId}/entities/{entityId}',
        'publicSearchIndex/{entityId}',
        'entityRelationships/{entityId}',
      ],
    },
  };
}

export function loadCatalogIndexFromDir(catalogDir: string): CatalogMatchIndex {
  return buildCatalogMatchIndex(loadCatalogEntitiesFromFixtures(catalogDir));
}
