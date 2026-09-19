/**
 * Postgres reads for evidence source-library views: `source_library`,
 * `published_citations`, `source_library_unmapped_hosts`, `source_library_fitness`.
 *
 * These are staff/service-role views layered over the evidence-source schema — none of them are
 * written from this module. `evidence.source_organizations` (the older, narrower table) stays
 * here too: some callers still read the plain organization registry rather than the library view.
 */
import { queryPostgres } from './canonical-postgres-client.js';

// ---------------------------------------------------------------------------------------------
// Source organizations (legacy registry — unchanged)
// ---------------------------------------------------------------------------------------------

export type SourceOrganizationListItem = {
  readonly id: string;
  readonly name: string;
  readonly homepageUrl?: string;
  readonly notes?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

type SourceOrgRow = {
  readonly id: string;
  readonly name: string;
  readonly homepage: string | null;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
};

export async function listSourceOrganizationsPostgres(
  limit: number,
): Promise<readonly SourceOrganizationListItem[]> {
  const cappedLimit = Math.min(200, Math.max(1, limit));
  const rows = await queryPostgres<SourceOrgRow>(
    `SELECT id, name, homepage, created_at, updated_at
     FROM evidence.source_organizations
     ORDER BY updated_at DESC
     LIMIT $1`,
    [cappedLimit],
  );

  return rows.map((row) => {
    const homepageUrl = readString(row.homepage ?? undefined);
    return {
      id: row.id,
      name: row.name,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
      ...(homepageUrl ? { homepageUrl } : {}),
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Source library
// ---------------------------------------------------------------------------------------------

export type PublisherKind =
  | 'government_archive'
  | 'government_agency'
  | 'court_legal'
  | 'academic_library_archive'
  | 'museum'
  | 'encyclopedia_reference'
  | 'news_media'
  | 'nonprofit_heritage'
  | 'wiki_crowd'
  | 'commercial_database'
  | 'other';

export type SourceTier = 'tier1' | 'tier2' | 'tier3';

export type SourceLibraryListItem = {
  readonly organizationId: string;
  readonly name: string;
  readonly publisherKind?: PublisherKind;
  readonly tier?: SourceTier;
  readonly publishedEntities: number;
  readonly publishedClaims: number;
  readonly canonicalEntities: number;
  readonly profileReviewedAt?: string;
  readonly profileReviewedBy?: string;
};

export type SourceLibraryEntry = SourceLibraryListItem & {
  readonly homepage?: string;
  readonly parentOrganizationId?: string;
  readonly summary?: string;
  readonly relevance?: string;
  readonly limitations: readonly string[];
  readonly profileSources: readonly string[];
  readonly hosts: readonly string[];
  readonly evidenceSources: number;
  readonly sourceItems: number;
  readonly mergedOrganizationIds: readonly string[];
};

export type SourceLibraryFitnessRow = {
  readonly policyId: string;
  readonly evidenceUse?: string;
  readonly fitness: 'authoritative' | 'strong' | 'conditional' | 'lead_only' | 'unfit';
  readonly limitations: readonly string[];
};

export type SourceEntityListItem = {
  readonly entityId: string;
  readonly entityKind: string;
  readonly entityDisplayName: string;
  readonly claimCount: number;
  readonly sampleCitationHref?: string;
};

export type UnmappedHostItem = {
  readonly host: string;
  readonly publishedEntities: number;
  readonly publishedClaims: number;
  readonly sampleHref?: string;
};

export type SourceLibraryTotals = {
  readonly publisherCount: number;
  readonly publishedClaimsMapped: number;
  readonly unmappedHostCount: number;
};

type SourceLibraryRow = {
  readonly organization_id: string;
  readonly name: string;
  readonly homepage: string | null;
  readonly parent_organization_id: string | null;
  readonly publisher_kind: string | null;
  readonly tier: string | null;
  readonly summary: string | null;
  readonly relevance: string | null;
  readonly limitations: readonly string[] | null;
  readonly profile_sources: readonly string[] | null;
  readonly profile_reviewed_at: Date | string | null;
  readonly profile_reviewed_by: string | null;
  readonly hosts: readonly string[] | null;
  readonly published_entities: number | string | null;
  readonly published_claims: number | string | null;
  readonly canonical_entities: number | string | null;
  readonly evidence_sources: number | string | null;
  readonly source_items: number | string | null;
  readonly merged_organization_ids: readonly string[] | null;
};

function readIsoOrUndefined(value: Date | string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  return toIso(value);
}

function readCount(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(num) ? num : 0;
}

function readStringArray(value: readonly string[] | null | undefined): readonly string[] {
  return value ?? [];
}

function readPublisherKind(value: string | null | undefined): PublisherKind | undefined {
  const known: readonly PublisherKind[] = [
    'government_archive',
    'government_agency',
    'court_legal',
    'academic_library_archive',
    'museum',
    'encyclopedia_reference',
    'news_media',
    'nonprofit_heritage',
    'wiki_crowd',
    'commercial_database',
    'other',
  ];
  return value && (known as readonly string[]).includes(value)
    ? (value as PublisherKind)
    : undefined;
}

function readTier(value: string | null | undefined): SourceTier | undefined {
  return value === 'tier1' || value === 'tier2' || value === 'tier3' ? value : undefined;
}

/** Pure row mapper — no query, so it is unit-testable against a literal row. */
export function mapSourceLibraryListRow(row: SourceLibraryRow): SourceLibraryListItem {
  const publisherKind = readPublisherKind(row.publisher_kind);
  const tier = readTier(row.tier);
  const profileReviewedAt = readIsoOrUndefined(row.profile_reviewed_at);
  const profileReviewedBy = readString(row.profile_reviewed_by ?? undefined);
  return {
    organizationId: row.organization_id,
    name: row.name,
    publishedEntities: readCount(row.published_entities),
    publishedClaims: readCount(row.published_claims),
    canonicalEntities: readCount(row.canonical_entities),
    ...(publisherKind ? { publisherKind } : {}),
    ...(tier ? { tier } : {}),
    ...(profileReviewedAt ? { profileReviewedAt } : {}),
    ...(profileReviewedBy ? { profileReviewedBy } : {}),
  };
}

/** Pure row mapper for the full detail entry — no query, unit-testable. */
export function mapSourceLibraryEntryRow(row: SourceLibraryRow): SourceLibraryEntry {
  const homepage = readString(row.homepage ?? undefined);
  const parentOrganizationId = readString(row.parent_organization_id ?? undefined);
  const summary = readString(row.summary ?? undefined);
  const relevance = readString(row.relevance ?? undefined);
  return {
    ...mapSourceLibraryListRow(row),
    ...(homepage ? { homepage } : {}),
    ...(parentOrganizationId ? { parentOrganizationId } : {}),
    ...(summary ? { summary } : {}),
    ...(relevance ? { relevance } : {}),
    limitations: readStringArray(row.limitations),
    profileSources: readStringArray(row.profile_sources),
    hosts: readStringArray(row.hosts),
    evidenceSources: readCount(row.evidence_sources),
    sourceItems: readCount(row.source_items),
    mergedOrganizationIds: readStringArray(row.merged_organization_ids),
  };
}

const SOURCE_LIBRARY_COLUMNS = `organization_id, name, homepage, parent_organization_id, publisher_kind,
     tier, summary, relevance, limitations, profile_sources, profile_reviewed_at,
     profile_reviewed_by, hosts, published_entities, published_claims, canonical_entities,
     evidence_sources, source_items, merged_organization_ids`;

export type SourceLibrarySort = 'entities' | 'name';

export async function listSourceLibraryPostgres(options: {
  readonly sort?: SourceLibrarySort;
  readonly q?: string;
  readonly limit?: number;
}): Promise<readonly SourceLibraryListItem[]> {
  const limit = Math.min(500, Math.max(1, options.limit ?? 200));
  const sort = options.sort ?? 'entities';
  const q = options.q?.trim();

  const params: unknown[] = [];
  let where = '';
  if (q) {
    params.push(`%${q}%`);
    where = `WHERE name ILIKE $${params.length}`;
  }
  const orderBy = sort === 'name' ? 'name ASC' : 'published_entities DESC NULLS LAST, name ASC';
  params.push(limit);

  const rows = await queryPostgres<SourceLibraryRow>(
    `SELECT ${SOURCE_LIBRARY_COLUMNS}
     FROM evidence.source_library
     ${where}
     ORDER BY ${orderBy}
     LIMIT $${params.length}`,
    params,
  );

  return rows.map(mapSourceLibraryListRow);
}

export async function getSourceLibraryTotalsPostgres(): Promise<SourceLibraryTotals> {
  const [libraryRows, unmappedRows] = await Promise.all([
    queryPostgres<{
      readonly publisher_count: number | string;
      readonly claims_mapped: number | string;
    }>(
      `SELECT count(*) AS publisher_count, coalesce(sum(published_claims), 0) AS claims_mapped
       FROM evidence.source_library`,
      [],
    ),
    queryPostgres<{ readonly unmapped_host_count: number | string }>(
      `SELECT count(*) AS unmapped_host_count FROM evidence.source_library_unmapped_hosts`,
      [],
    ),
  ]);

  return {
    publisherCount: readCount(libraryRows[0]?.publisher_count),
    publishedClaimsMapped: readCount(libraryRows[0]?.claims_mapped),
    unmappedHostCount: readCount(unmappedRows[0]?.unmapped_host_count),
  };
}

export async function getSourceLibraryEntryPostgres(
  organizationId: string,
): Promise<SourceLibraryEntry | null> {
  const rows = await queryPostgres<SourceLibraryRow>(
    `SELECT ${SOURCE_LIBRARY_COLUMNS}
     FROM evidence.source_library
     WHERE organization_id = $1
     LIMIT 1`,
    [organizationId],
  );
  const row = rows[0];
  return row ? mapSourceLibraryEntryRow(row) : null;
}

type FitnessRow = {
  readonly policy_id: string;
  readonly evidence_use: string | null;
  readonly fitness: string;
  readonly limitations: readonly string[] | null;
};

/** Pure row mapper — no query, unit-testable. */
export function mapSourceLibraryFitnessRow(row: FitnessRow): SourceLibraryFitnessRow {
  const evidenceUse = readString(row.evidence_use ?? undefined);
  return {
    policyId: row.policy_id,
    fitness: row.fitness as SourceLibraryFitnessRow['fitness'],
    limitations: readStringArray(row.limitations),
    ...(evidenceUse ? { evidenceUse } : {}),
  };
}

export async function listSourceLibraryFitnessPostgres(
  organizationId: string,
): Promise<readonly SourceLibraryFitnessRow[]> {
  const rows = await queryPostgres<FitnessRow>(
    `SELECT policy_id, evidence_use, fitness, limitations
     FROM evidence.source_library_fitness
     WHERE organization_id = $1
     ORDER BY policy_id ASC`,
    [organizationId],
  );
  return rows.map(mapSourceLibraryFitnessRow);
}

type SourceEntityRow = {
  readonly entity_id: string;
  readonly entity_kind: string;
  readonly entity_display_name: string;
  readonly claim_count: number | string;
  readonly sample_citation_href: string | null;
};

/** Pure row mapper — no query, unit-testable. */
export function mapSourceEntityRow(row: SourceEntityRow): SourceEntityListItem {
  const sampleCitationHref = readString(row.sample_citation_href ?? undefined);
  return {
    entityId: row.entity_id,
    entityKind: row.entity_kind,
    entityDisplayName: row.entity_display_name,
    claimCount: readCount(row.claim_count),
    ...(sampleCitationHref ? { sampleCitationHref } : {}),
  };
}

export type SourceEntityPage = {
  readonly rows: readonly SourceEntityListItem[];
  readonly total: number;
};

export async function listSourceEntitiesPostgres(
  organizationId: string,
  options: { readonly limit?: number; readonly offset?: number } = {},
): Promise<SourceEntityPage> {
  const limit = Math.min(200, Math.max(1, options.limit ?? 50));
  const offset = Math.max(0, options.offset ?? 0);

  const [rows, countRows] = await Promise.all([
    queryPostgres<SourceEntityRow>(
      `SELECT entity_id,
              max(entity_kind) AS entity_kind,
              max(entity_display_name) AS entity_display_name,
              count(*) AS claim_count,
              min(citation_href) AS sample_citation_href
       FROM evidence.published_citations
       WHERE organization_id = $1
       GROUP BY entity_id
       ORDER BY count(*) DESC, entity_id ASC
       LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset],
    ),
    queryPostgres<{ readonly total: number | string }>(
      `SELECT count(DISTINCT entity_id) AS total
       FROM evidence.published_citations
       WHERE organization_id = $1`,
      [organizationId],
    ),
  ]);

  return {
    rows: rows.map(mapSourceEntityRow),
    total: readCount(countRows[0]?.total),
  };
}

type UnmappedHostRow = {
  readonly host: string;
  readonly published_entities: number | string;
  readonly published_claims: number | string;
  readonly sample_href: string | null;
};

/** Pure row mapper — no query, unit-testable. */
export function mapUnmappedHostRow(row: UnmappedHostRow): UnmappedHostItem {
  const sampleHref = readString(row.sample_href ?? undefined);
  return {
    host: row.host,
    publishedEntities: readCount(row.published_entities),
    publishedClaims: readCount(row.published_claims),
    ...(sampleHref ? { sampleHref } : {}),
  };
}

export async function listUnmappedHostsPostgres(
  limit: number,
): Promise<readonly UnmappedHostItem[]> {
  const cappedLimit = Math.min(200, Math.max(1, limit));
  const rows = await queryPostgres<UnmappedHostRow>(
    `SELECT host, published_entities, published_claims, sample_href
     FROM evidence.source_library_unmapped_hosts
     ORDER BY published_entities DESC, host ASC
     LIMIT $1`,
    [cappedLimit],
  );
  return rows.map(mapUnmappedHostRow);
}
