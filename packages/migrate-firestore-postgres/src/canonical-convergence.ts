import { createHash } from 'node:crypto';

type JsonRecord = Record<string, unknown>;

export type ActiveReleaseRow = {
  readonly release_id: string;
  readonly entity_id: string;
  readonly display_name: string;
  readonly kind: string;
  readonly summary: string | null;
  readonly location: unknown;
  readonly geohash: string | null;
  readonly lat: number | null;
  readonly lng: number | null;
  readonly claims: unknown;
  readonly taxonomy: unknown;
  readonly related: unknown;
  readonly primary_image: unknown;
  readonly projection: unknown;
  readonly search_aliases: readonly string[];
  readonly created_at: string;
};

export type CanonicalEntityPlanRow = {
  readonly id: string;
  readonly kind: string;
  readonly entity_class: string | null;
  readonly display_name: string;
  readonly aliases: readonly string[];
  readonly living_status: string;
  readonly status_history: readonly unknown[];
  readonly notability_basis: readonly unknown[];
  readonly sensitivity: readonly unknown[];
  readonly kind_detail: JsonRecord;
  readonly created_at: string;
};

export type CanonicalLocationPlanRow = {
  readonly id: string;
  readonly entity_id: string;
  readonly role: 'approximate';
  readonly geometry: JsonRecord;
  readonly lat: number;
  readonly lng: number;
  readonly geohash: string | null;
  readonly geohash_prefixes: readonly string[];
  readonly precision: string | null;
  readonly match_method: string;
  readonly label: string | null;
  readonly created_at: string;
};

export type CanonicalClaimPlanRow = {
  readonly id: string;
  readonly entity_id: string;
  readonly current_version_id: string;
  readonly claim_class: 'standard';
  readonly workflow_status: 'accepted';
  readonly publication_status: 'published';
  readonly procedural_status: 'ruled';
  readonly confidence: JsonRecord;
  readonly research_coverage: JsonRecord;
  readonly verification: JsonRecord;
  readonly created_at: string;
};

export type CanonicalClaimVersionPlanRow = {
  readonly id: string;
  readonly claim_id: string;
  readonly predicate: string;
  readonly object: unknown;
  readonly workflow_status: 'accepted';
  readonly publication_status: 'published';
  readonly confidence: JsonRecord;
  readonly body: JsonRecord;
  readonly created_at: string;
  readonly created_by: 'canonical-convergence';
};

export type SourceOrganizationPlanRow = {
  readonly id: string;
  readonly name: string;
  readonly homepage: string;
};

export type SourceDomainPlanRow = {
  readonly id: string;
  readonly organization_id: string;
  readonly hostname: string;
};

export type EvidenceSourcePlanRow = {
  readonly id: string;
  readonly organization_id: string;
  readonly display_name: string;
  readonly adapter_id: 'canonical-convergence';
  readonly rights: JsonRecord;
};

export type SourceItemPlanRow = {
  readonly id: string;
  readonly source_id: string;
  readonly stable_identifier: string;
  readonly title: string;
  readonly url: string;
  readonly metadata: JsonRecord;
};

export type EvidenceRecordPlanRow = {
  readonly id: string;
  readonly source_item_id: string;
  readonly rights_status: 'unknown';
  readonly excerpt: null;
  readonly lineage_root_id: string;
  readonly metadata: JsonRecord;
};

export type ClaimEvidenceLinkPlanRow = {
  readonly id: string;
  readonly claim_id: string;
  readonly claim_version_id: string;
  readonly evidence_id: string;
  readonly role: 'supporting';
  readonly lineage_root_id: string;
  readonly quality: JsonRecord;
  readonly asserted_value: unknown;
};

export type EntityRelationshipPlanRow = {
  readonly id: string;
  readonly from_entity_id: string;
  readonly to_entity_id: string;
  readonly relationship_type: string;
  readonly valid_from: string | null;
  readonly valid_to: string | null;
  readonly workflow_status: 'accepted';
  readonly publication_status: 'published';
  readonly confidence: JsonRecord;
  readonly geographic: JsonRecord;
};

export type CanonicalConvergencePlan = {
  readonly releaseId: string;
  readonly planHash: string;
  readonly entities: readonly CanonicalEntityPlanRow[];
  readonly locations: readonly CanonicalLocationPlanRow[];
  readonly claims: readonly CanonicalClaimPlanRow[];
  readonly claimVersions: readonly CanonicalClaimVersionPlanRow[];
  readonly sourceOrganizations: readonly SourceOrganizationPlanRow[];
  readonly sourceDomains: readonly SourceDomainPlanRow[];
  readonly evidenceSources: readonly EvidenceSourcePlanRow[];
  readonly sourceItems: readonly SourceItemPlanRow[];
  readonly evidenceRecords: readonly EvidenceRecordPlanRow[];
  readonly claimEvidenceLinks: readonly ClaimEvidenceLinkPlanRow[];
  readonly relationships: readonly EntityRelationshipPlanRow[];
  readonly warnings: readonly string[];
};

type ReleaseClaim = {
  readonly id: string;
  readonly predicate: string;
  readonly object: string;
  readonly confidenceLevel: string;
  readonly citationSource: string;
  readonly citationHref: string;
  readonly citationLabel: string;
  readonly independentLineageCount?: number;
  readonly recoverySource?: string;
};

type LegacyClaimSupplement = ReleaseClaim & {
  readonly entityId: string;
};

/**
 * Four original seed projections reached Postgres with `{}` in `claims`. The cited claim text
 * remains in the repository's authored public seed. These supplements recover that information
 * explicitly; they are not inferred from summaries.
 */
export const LEGACY_SEED_CLAIM_SUPPLEMENTS: readonly LegacyClaimSupplement[] = [
  {
    entityId: 'ent_15th_st_church_001',
    id: 'claim_seed_001',
    predicate: 'founded_year',
    object: '1841',
    confidenceLevel: 'high',
    citationSource: 'HMdb.org — historical marker database',
    citationHref: 'https://www.hmdb.org/m.asp?m=112661',
    citationLabel: 'Historical marker',
    recoverySource: 'apps/web/src/data/public-seed.ts',
  },
  {
    entityId: 'ent_15th_st_church_001',
    id: 'claim_church_hosted_dunbar_founding_1870',
    predicate: 'hosted_founding_of',
    object: 'Preparatory High School for Colored Youth (1870), in the church basement',
    confidenceLevel: 'high',
    citationSource: 'Howard University Moorland-Spingarn Research Center — finding aid',
    citationHref: 'https://dh.howard.edu/finaid_manu/74/',
    citationLabel: 'Archival finding aid',
    recoverySource: 'apps/web/src/data/public-seed.ts',
  },
  {
    entityId: 'ent_dunbar_school_001',
    id: 'claim_dunbar_founded_1870',
    predicate: 'founded_as',
    object: 'Preparatory High School for Colored Youth (1870)',
    confidenceLevel: 'high',
    citationSource: 'DC Historic Sites — DC Preservation League',
    citationHref: 'https://historicsites.dcpreservation.org/items/show/162',
    citationLabel: 'Preservation register',
    recoverySource: 'apps/web/src/data/public-seed.ts',
  },
  {
    entityId: 'ent_dunbar_school_001',
    id: 'claim_dunbar_renamed_m_street_1891',
    predicate: 'renamed_and_relocated',
    object: 'M Street High School (1891), permanent building',
    confidenceLevel: 'medium',
    citationSource: 'Boundary Stones — WETA/PBS D.C. public history',
    citationHref:
      'https://boundarystones.weta.org/2024/11/14/dunbar-evolution-americas-first-black-public-high-school',
    citationLabel: 'Public history feature',
    recoverySource: 'apps/web/src/data/public-seed.ts',
  },
  {
    entityId: 'ent_dunbar_school_001',
    id: 'claim_dunbar_renamed_dunbar_1916',
    predicate: 'renamed_and_relocated',
    object:
      'Paul Laurence Dunbar High School (1916), 1st & N Street NW, designed by architect Snowden Ashford',
    confidenceLevel: 'high',
    citationSource: 'Wikipedia — Dunbar High School (Washington, D.C.)',
    citationHref: 'https://en.wikipedia.org/wiki/Dunbar_High_School_(Washington,_D.C.)',
    citationLabel: 'Encyclopedia reference',
    recoverySource: 'apps/web/src/data/public-seed.ts',
  },
  {
    entityId: 'ent_dunbar_school_001',
    id: 'claim_dunbar_demolitions_1977_2013',
    predicate: 'building_history',
    object:
      'The 1916 building was demolished in 1977; its 1970s replacement was itself demolished in 2013; the current building opened in 2013 on the same footprint',
    confidenceLevel: 'medium',
    citationSource: 'National Trust for Historic Preservation',
    citationHref:
      'https://savingplaces.org/stories/americas-first-african-american-public-high-school',
    citationLabel: 'Preservation feature',
    recoverySource: 'apps/web/src/data/public-seed.ts',
  },
  {
    entityId: 'ent_dc_landmark_listing_1975',
    id: 'claim_landmark_listed_1975',
    predicate: 'listed_on',
    object: 'D.C. Inventory of Historic Sites (April 29, 1975)',
    confidenceLevel: 'medium',
    citationSource: 'DC Historic Sites — DC Preservation League',
    citationHref: 'https://historicsites.dcpreservation.org/items/show/162',
    citationLabel: 'Preservation register',
    recoverySource: 'apps/web/src/data/public-seed.ts',
  },
  {
    entityId: 'ent_dunbar_alumni_federation_001',
    id: 'claim_alumni_organized_2002',
    predicate: 'organized_year',
    object: '2002',
    confidenceLevel: 'medium',
    citationSource: 'Dunbar Alumni Federation — About',
    citationHref: 'https://www.daf-dc.org/about-us',
    citationLabel: 'Organization self-report',
    recoverySource: 'apps/web/src/data/public-seed.ts',
  },
  {
    entityId: 'ent_dunbar_alumni_federation_001',
    id: 'claim_alumni_tax_exempt_2003',
    predicate: 'tax_exempt_since',
    object: 'July 2003 (IRS 501(c)(3))',
    confidenceLevel: 'high',
    citationSource: 'ProPublica Nonprofit Explorer',
    citationHref: 'https://projects.propublica.org/nonprofits/organizations/10712951',
    citationLabel: 'Nonprofit filing lookup',
    recoverySource: 'apps/web/src/data/public-seed.ts',
  },
];

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as JsonRecord)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function stableJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function stableDigest(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

export function stableId(prefix: string, value: unknown): string {
  return `${prefix}_${stableDigest(value).slice(0, 32)}`;
}

export function inferEntityClass(kind: string): string | null {
  if (kind === 'person') return 'person';
  if (kind === 'place') return 'place';
  if (kind === 'organization' || kind === 'institution' || kind === 'school') {
    return 'organization';
  }
  if (kind === 'event') return 'event';
  if (kind === 'law' || kind === 'case') return 'legal';
  if (kind === 'publication' || kind === 'artifact') return 'work';
  if (kind === 'movement') return 'movement';
  return null;
}

function parseClaim(value: unknown): ReleaseClaim | undefined {
  const claim = asRecord(value);
  const id = asString(claim.id);
  const predicate = asString(claim.predicate);
  const object = asString(claim.object);
  const citationSource = asString(claim.citationSource);
  const citationHref = asString(claim.citationHref);
  const citationLabel = asString(claim.citationLabel);
  if (!id || !predicate || !object || !citationSource || !citationHref || !citationLabel) {
    return undefined;
  }
  const independentLineageCount =
    typeof claim.independentLineageCount === 'number' &&
    Number.isFinite(claim.independentLineageCount)
      ? claim.independentLineageCount
      : undefined;
  return {
    id,
    predicate,
    object,
    confidenceLevel: asString(claim.confidenceLevel) ?? 'unknown',
    citationSource,
    citationHref,
    citationLabel,
    ...(independentLineageCount !== undefined ? { independentLineageCount } : {}),
  };
}

function isoDate(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;
  if (/^\d{4}$/.test(raw)) return `${raw}-01-01`;
  if (/^\d{4}-\d{2}$/.test(raw)) return `${raw}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return null;
}

function buildEditorialDetail(row: ActiveReleaseRow, projection: JsonRecord): JsonRecord {
  const classification = {
    taxonomy: row.taxonomy,
    eraBuckets: asStringArray(projection.eraBuckets),
    topicTags: asStringArray(projection.topicTags),
    topicIds: asStringArray(projection.topicIds),
    keywords: asStringArray(projection.keywords),
    mentionedEntityIds: asStringArray(projection.mentionedEntityIds),
    campaignIds: asStringArray(projection.campaignIds),
    researchCoverage: asString(projection.researchCoverage) ?? null,
  };
  return {
    editorial: {
      summary: row.summary ?? '',
      historicalContext: asString(projection.historicalContext) ?? null,
      extendedNarrative: asString(projection.extendedNarrative) ?? null,
    },
    classification,
    jurisdiction: {
      label: asString(projection.jurisdictionLabel) ?? null,
    },
    publication: {
      sourceReleaseId: row.release_id,
      sourceProjectionCreatedAt: row.created_at,
      source: 'active_public_release_backfill',
    },
    ...(row.primary_image !== null && row.primary_image !== undefined
      ? { media: { primaryImage: row.primary_image } }
      : {}),
  };
}

function relationshipKey(row: Omit<EntityRelationshipPlanRow, 'id'>): string {
  return stableJson([
    row.from_entity_id,
    row.relationship_type,
    row.to_entity_id,
    row.valid_from,
    row.valid_to,
  ]);
}

export function buildCanonicalConvergencePlan(
  inputRows: readonly ActiveReleaseRow[],
  supplements: readonly LegacyClaimSupplement[] = LEGACY_SEED_CLAIM_SUPPLEMENTS,
): CanonicalConvergencePlan {
  if (inputRows.length === 0) throw new Error('Active release contains no entity rows');
  const rows = [...inputRows].sort((left, right) => left.entity_id.localeCompare(right.entity_id));
  const releaseId = rows[0]!.release_id;
  if (rows.some((row) => row.release_id !== releaseId)) {
    throw new Error('Convergence input spans more than one release');
  }

  const warnings: string[] = [];
  const entities: CanonicalEntityPlanRow[] = [];
  const locations: CanonicalLocationPlanRow[] = [];
  const claims = new Map<string, CanonicalClaimPlanRow>();
  const claimVersions = new Map<string, CanonicalClaimVersionPlanRow>();
  const sourceOrganizations = new Map<string, SourceOrganizationPlanRow>();
  const sourceDomains = new Map<string, SourceDomainPlanRow>();
  const evidenceSources = new Map<string, EvidenceSourcePlanRow>();
  const sourceItems = new Map<string, SourceItemPlanRow>();
  const evidenceRecords = new Map<string, EvidenceRecordPlanRow>();
  const claimEvidenceLinks = new Map<string, ClaimEvidenceLinkPlanRow>();
  const relationships = new Map<string, EntityRelationshipPlanRow>();
  const knownEntityIds = new Set(rows.map((row) => row.entity_id));
  const supplementsByEntity = new Map<string, LegacyClaimSupplement[]>();

  for (const supplement of supplements) {
    if (!knownEntityIds.has(supplement.entityId)) continue;
    const bucket = supplementsByEntity.get(supplement.entityId) ?? [];
    bucket.push(supplement);
    supplementsByEntity.set(supplement.entityId, bucket);
  }

  for (const row of rows) {
    const projection = asRecord(row.projection);
    const location = asRecord(row.location);
    const statusHistory = asArray(projection.statusHistory);
    const notabilityBasis = asArray(projection.notabilityBasis);
    const sensitivityClass = asString(projection.sensitivityClass);
    entities.push({
      id: row.entity_id,
      kind: row.kind,
      entity_class: inferEntityClass(row.kind),
      display_name: row.display_name,
      aliases: [...new Set(row.search_aliases)].sort(),
      living_status:
        row.kind === 'person' ? (asString(projection.livingStatus) ?? 'unknown') : 'not_applicable',
      status_history: statusHistory,
      notability_basis: notabilityBasis,
      sensitivity: sensitivityClass
        ? [{ class: sensitivityClass, source: 'active_public_release_backfill' }]
        : [],
      kind_detail: buildEditorialDetail(row, projection),
      created_at: row.created_at,
    });

    if (typeof row.lat === 'number' && typeof row.lng === 'number') {
      const geohashPrefixes = asStringArray(location.geohashPrefixes);
      locations.push({
        id: stableId('loc_release', row.entity_id),
        entity_id: row.entity_id,
        role: 'approximate',
        geometry: { type: 'Point', coordinates: [row.lng, row.lat] },
        lat: row.lat,
        lng: row.lng,
        geohash: row.geohash ?? asString(location.geohash) ?? null,
        geohash_prefixes: geohashPrefixes,
        precision: asString(location.precision) ?? null,
        match_method: asString(location.matchMethod) ?? 'active_release_backfill',
        label: asString(projection.locationLabel) ?? null,
        created_at: row.created_at,
      });
    } else {
      warnings.push(`${row.entity_id}: active projection has no usable coordinates`);
    }

    const rawClaims = Array.isArray(row.claims) ? row.claims : [];
    if (!Array.isArray(row.claims)) {
      warnings.push(
        `${row.entity_id}: legacy claims value is ${typeof row.claims}; using cited supplements where available`,
      );
    }
    const parsedClaims = rawClaims
      .map(parseClaim)
      .filter((claim): claim is ReleaseClaim => !!claim);
    if (parsedClaims.length !== rawClaims.length) {
      throw new Error(`${row.entity_id}: one or more published claims are structurally incomplete`);
    }
    const seenClaimIds = new Set(parsedClaims.map((claim) => claim.id));
    for (const supplement of (supplementsByEntity.get(row.entity_id) ?? []).sort((left, right) =>
      left.id.localeCompare(right.id),
    )) {
      if (!seenClaimIds.has(supplement.id)) {
        parsedClaims.push(supplement);
        seenClaimIds.add(supplement.id);
        warnings.push(`${row.entity_id}: recovered cited legacy claim ${supplement.id}`);
      }
    }

    for (const claim of parsedClaims.sort((left, right) => left.id.localeCompare(right.id))) {
      const citationUrl = new URL(claim.citationHref);
      if (citationUrl.protocol !== 'https:' && citationUrl.protocol !== 'http:') {
        throw new Error(`${claim.id}: citation URL must use HTTP(S)`);
      }
      const hostname = citationUrl.hostname.toLowerCase();
      const organizationId = stableId('org_web', hostname);
      const domainId = stableId('dom_web', hostname);
      const sourceId = stableId('src_web', [claim.citationSource.toLowerCase(), hostname]);
      const sourceItemId = stableId('item_web', [sourceId, claim.citationHref]);
      const evidenceId = stableId('ev_web', sourceItemId);
      const versionBody = {
        citation: {
          source: claim.citationSource,
          href: claim.citationHref,
          label: claim.citationLabel,
        },
        provenance: {
          method: 'active_public_release_backfill',
          releaseId,
          ...(claim.recoverySource ? { recoverySource: claim.recoverySource } : {}),
        },
        limitations: {
          sourceCapturePresent: false,
          supportingExcerptPresent: false,
          note: 'The public projection retained the citation reference but not a captured source body or supporting excerpt.',
        },
      };
      const versionId = stableId('clv', [
        claim.id,
        row.entity_id,
        claim.predicate,
        claim.object,
        versionBody,
      ]);
      const confidence = {
        level: claim.confidenceLevel,
        ...(claim.independentLineageCount !== undefined
          ? { independentLineageCount: claim.independentLineageCount }
          : {}),
        source: 'published_projection',
      };

      const previousClaim = claims.get(claim.id);
      if (previousClaim && previousClaim.entity_id !== row.entity_id) {
        throw new Error(
          `Published claim id ${claim.id} belongs to both ${previousClaim.entity_id} and ${row.entity_id}`,
        );
      }
      claims.set(claim.id, {
        id: claim.id,
        entity_id: row.entity_id,
        current_version_id: versionId,
        claim_class: 'standard',
        workflow_status: 'accepted',
        publication_status: 'published',
        procedural_status: 'ruled',
        confidence,
        research_coverage: {
          level: asString(projection.researchCoverage) ?? 'unknown',
          source: 'published_projection',
        },
        verification: {
          status: 'legacy_published_projection',
          releaseId,
          citationReferencePresent: true,
          sourceCapturePresent: false,
          supportingExcerptPresent: false,
        },
        created_at: row.created_at,
      });
      claimVersions.set(versionId, {
        id: versionId,
        claim_id: claim.id,
        predicate: claim.predicate,
        object: claim.object,
        workflow_status: 'accepted',
        publication_status: 'published',
        confidence,
        body: versionBody,
        created_at: row.created_at,
        created_by: 'canonical-convergence',
      });

      if (!sourceOrganizations.has(organizationId)) {
        sourceOrganizations.set(organizationId, {
          id: organizationId,
          name: claim.citationSource,
          homepage: citationUrl.origin,
        });
      }
      sourceDomains.set(domainId, {
        id: domainId,
        organization_id: organizationId,
        hostname,
      });
      evidenceSources.set(sourceId, {
        id: sourceId,
        organization_id: organizationId,
        display_name: claim.citationSource,
        adapter_id: 'canonical-convergence',
        rights: {
          status: 'unknown',
          citationOnly: true,
          note: 'Rights and reuse terms were not present in the public release projection.',
        },
      });
      sourceItems.set(sourceItemId, {
        id: sourceItemId,
        source_id: sourceId,
        stable_identifier: claim.citationHref,
        title: claim.citationLabel,
        url: claim.citationHref,
        metadata: {
          citationSource: claim.citationSource,
          importedFromRelease: releaseId,
          sourceCapturePresent: false,
        },
      });
      evidenceRecords.set(evidenceId, {
        id: evidenceId,
        source_item_id: sourceItemId,
        rights_status: 'unknown',
        excerpt: null,
        lineage_root_id: evidenceId,
        metadata: {
          citationLabel: claim.citationLabel,
          importedFromRelease: releaseId,
          sourceCapturePresent: false,
          supportingExcerptPresent: false,
        },
      });
      const linkId = stableId('cel', [claim.id, versionId, evidenceId, 'supporting']);
      claimEvidenceLinks.set(linkId, {
        id: linkId,
        claim_id: claim.id,
        claim_version_id: versionId,
        evidence_id: evidenceId,
        role: 'supporting',
        lineage_root_id: evidenceId,
        quality: {
          status: 'legacy_projection_citation',
          captured: false,
          excerptAvailable: false,
        },
        asserted_value: claim.object,
      });
    }

    const rawRelated = Array.isArray(row.related) ? row.related : [];
    for (const item of rawRelated) {
      const related = asRecord(item);
      const relatedId = asString(related.id);
      const relationshipType = asString(related.type);
      const direction = asString(related.direction);
      if (!relatedId || !relationshipType || !['incoming', 'outgoing'].includes(direction ?? '')) {
        throw new Error(`${row.entity_id}: malformed related entry in active projection`);
      }
      if (!knownEntityIds.has(relatedId)) {
        warnings.push(
          `${row.entity_id}: related entity ${relatedId} is outside the active release`,
        );
        continue;
      }
      const timespan = asRecord(related.timespan);
      const base: Omit<EntityRelationshipPlanRow, 'id'> = {
        from_entity_id: direction === 'outgoing' ? row.entity_id : relatedId,
        to_entity_id: direction === 'outgoing' ? relatedId : row.entity_id,
        relationship_type: relationshipType,
        valid_from: isoDate(timespan.validFrom),
        valid_to: isoDate(timespan.validTo),
        workflow_status: 'accepted',
        publication_status: 'published',
        confidence: { source: 'published_projection', level: 'unknown' },
        geographic: { sourceReleaseId: releaseId },
      };
      const key = relationshipKey(base);
      relationships.set(key, {
        id: stableId('rel_release', key),
        ...base,
      });
    }
  }

  const planWithoutHash = {
    releaseId,
    entities,
    locations,
    claims: [...claims.values()].sort((left, right) => left.id.localeCompare(right.id)),
    claimVersions: [...claimVersions.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    sourceOrganizations: [...sourceOrganizations.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    sourceDomains: [...sourceDomains.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    evidenceSources: [...evidenceSources.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    sourceItems: [...sourceItems.values()].sort((left, right) => left.id.localeCompare(right.id)),
    evidenceRecords: [...evidenceRecords.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    claimEvidenceLinks: [...claimEvidenceLinks.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    relationships: [...relationships.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    warnings,
  };
  return {
    ...planWithoutHash,
    planHash: stableDigest(planWithoutHash),
  };
}
