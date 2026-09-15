/**
 * Pure planning logic for backfill-canonical-claims-from-release.ts.
 *
 * Input is a snapshot of the rows the planner needs to see (active-release entities that have no
 * bb_canonical.claims rows, plus the evidence library it resolves citations against). Output is
 * the exact set of rows to insert. Nothing here touches a database, so the resolution rules are
 * testable on their own.
 *
 * Row shapes and id derivations mirror
 * packages/migrate-firestore-postgres/src/canonical-convergence.ts, the writer that produced the
 * roughly 15.7k traced claims already in bb_canonical. Two deliberate differences:
 *
 *  1. Source resolution does not mint one organization, domain and evidence source per raw
 *     hostname and citation string. It resolves the citation host (lowercase, www-stripped) to an
 *     existing organization by longest suffix match on source_domains.hostname, follows
 *     merged_into_organization_id when that column exists, and reuses the organization's evidence
 *     source with the most source_items. New organizations are minted only for hosts nothing
 *     matches, one per www-stripped host, and shorter hosts are minted first so a later subdomain
 *     in the same run resolves to them.
 *  2. Provenance method is `canonical_claims_backfill_from_release`, so these rows can be told
 *     apart from the convergence run.
 */
import { createHash } from 'node:crypto';

export const BACKFILL_METHOD = 'canonical_claims_backfill_from_release';
export const BACKFILL_ACTOR = 'canonical-claims-backfill';

// --- Stable ids (mirror of canonical-convergence.ts stableJson/stableDigest/stableId) ---------
// Kept as a copy rather than a cross-package import: ops-data does not depend on
// @repo/migrate-firestore-postgres. The unit test pins parity against an id that module wrote.

type JsonRecord = Record<string, unknown>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
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

export function stableId(prefix: string, value: unknown): string {
  return `${prefix}_${createHash('sha256').update(stableJson(value)).digest('hex').slice(0, 32)}`;
}

// --- Snapshot types ---------------------------------------------------------------------------

export type SnapshotEntity = {
  readonly entityId: string;
  readonly kind: string;
  readonly researchCoverage: string | null;
  readonly canonicalEntityExists: boolean;
  readonly claims: unknown;
};

export type SnapshotDomain = {
  readonly id: string;
  readonly organizationId: string;
  readonly hostname: string;
};

export type SnapshotOrganization = {
  readonly id: string;
  /** null when the column is absent or unset. */
  readonly mergedIntoOrganizationId: string | null;
};

export type SnapshotSource = {
  readonly id: string;
  readonly organizationId: string | null;
  readonly itemCount: number;
};

export type SnapshotItem = {
  readonly id: string;
  readonly sourceId: string;
  readonly stableIdentifier: string;
  readonly url: string | null;
};

export type SnapshotEvidence = {
  readonly id: string;
  readonly sourceItemId: string;
  readonly excerpt: string | null;
};

export type PlanSnapshot = {
  readonly releaseId: string;
  readonly entities: readonly SnapshotEntity[];
  readonly domains: readonly SnapshotDomain[];
  readonly organizations: readonly SnapshotOrganization[];
  readonly sources: readonly SnapshotSource[];
  /** Only items whose url or stable_identifier equals some citation href in scope. */
  readonly items: readonly SnapshotItem[];
  /** Only evidence records on the items above. */
  readonly evidence: readonly SnapshotEvidence[];
  /** Public claim ids already present in bb_canonical.claims (any entity). */
  readonly existingClaimIds: ReadonlySet<string>;
  /**
   * Ids the planner would mint that already exist in their table, keyed by table. The script
   * fills this by planning once, querying the generated ids, and planning again.
   */
  readonly existingGeneratedIds: {
    readonly organizations: ReadonlySet<string>;
    readonly domains: ReadonlySet<string>;
    readonly sources: ReadonlySet<string>;
    readonly items: ReadonlySet<string>;
    readonly evidence: ReadonlySet<string>;
    readonly claimVersions: ReadonlySet<string>;
    readonly links: ReadonlySet<string>;
  };
};

// --- Plan types -------------------------------------------------------------------------------

export type ReleaseClaim = {
  readonly id: string;
  readonly predicate: string;
  readonly object: string;
  readonly claimRole: string | null;
  readonly citationHref: string;
  readonly citationLabel: string;
  readonly citationSource: string;
  readonly confidenceLevel: string;
};

export type OrganizationInsert = { id: string; name: string; homepage: string };
export type DomainInsert = { id: string; organization_id: string; hostname: string };
export type EvidenceSourceInsert = {
  id: string;
  organization_id: string;
  display_name: string;
  adapter_id: string;
  rights: JsonRecord;
};
export type SourceItemInsert = {
  id: string;
  source_id: string;
  stable_identifier: string;
  title: string;
  url: string;
  metadata: JsonRecord;
};
export type EvidenceRecordInsert = {
  id: string;
  source_item_id: string;
  rights_status: 'unknown';
  excerpt: null;
  lineage_root_id: string;
  metadata: JsonRecord;
};
export type ClaimInsert = {
  id: string;
  entity_id: string;
  current_version_id: string;
  claim_class: 'standard';
  workflow_status: 'accepted';
  publication_status: 'published';
  procedural_status: 'ruled';
  confidence: JsonRecord;
  research_coverage: JsonRecord;
  verification: JsonRecord;
};
export type ClaimVersionInsert = {
  id: string;
  claim_id: string;
  predicate: string;
  object: string;
  workflow_status: 'accepted';
  publication_status: 'published';
  confidence: JsonRecord;
  body: JsonRecord;
  created_by: string;
};
export type ClaimEvidenceLinkInsert = {
  id: string;
  claim_id: string;
  claim_version_id: string;
  evidence_id: string;
  role: 'supporting';
  lineage_root_id: string;
  quality: JsonRecord;
  asserted_value: string;
};

export type ClaimResolution = {
  readonly claimId: string;
  readonly host: string;
  readonly organizationId: string;
  readonly organizationResolution: 'matched' | 'matched_via_merge' | 'new_in_run';
  readonly matchedDomainHostname: string | null;
  readonly sourceId: string;
  readonly sourceResolution: 'reused' | 'new';
  readonly sourceItemId: string;
  readonly sourceItemResolution: 'reused_same_source' | 'reused_by_url' | 'new';
  readonly evidenceId: string;
  readonly evidenceResolution: 'reused' | 'new';
};

export type EntityPlan = {
  readonly entityId: string;
  readonly kind: string;
  readonly blocked: readonly string[];
  readonly claims: readonly ClaimInsert[];
  readonly claimVersions: readonly ClaimVersionInsert[];
  readonly links: readonly ClaimEvidenceLinkInsert[];
  readonly resolutions: readonly ClaimResolution[];
};

export type BackfillPlan = {
  readonly releaseId: string;
  readonly entities: readonly EntityPlan[];
  /** Shared rows, inserted once for the whole run. Only rows from unblocked entities. */
  readonly organizations: readonly OrganizationInsert[];
  readonly domains: readonly DomainInsert[];
  readonly evidenceSources: readonly EvidenceSourceInsert[];
  readonly sourceItems: readonly SourceItemInsert[];
  readonly evidenceRecords: readonly EvidenceRecordInsert[];
  readonly totals: PlanTotals;
  readonly ambiguousHosts: readonly { host: string; organizationIds: string[]; chosen: string }[];
  readonly unmatchedHosts: readonly string[];
};

export type PlanTotals = {
  readonly entitiesInScope: number;
  readonly entitiesPlanned: number;
  readonly entitiesBlocked: number;
  readonly claims: number;
  readonly claimVersions: number;
  readonly links: number;
  readonly evidenceRecordsReused: number;
  readonly evidenceRecordsNew: number;
  readonly sourceItemsReused: number;
  readonly sourceItemsNew: number;
  readonly evidenceSourcesReused: number;
  readonly evidenceSourcesNew: number;
  readonly organizationsMatched: number;
  readonly organizationsNew: number;
  readonly domainsNew: number;
  readonly hostsUnmatched: number;
  readonly hostsAmbiguous: number;
  readonly claimsResolvedViaMerge: number;
};

// --- Helpers ----------------------------------------------------------------------------------

/** Lowercase, www-stripped hostname of an http(s) URL, or null. */
export function normalizeHost(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host) return null;
  return stripWww(host);
}

export function stripWww(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '');
}

/** Host, then each parent at a label boundary: a.b.c.org, b.c.org, c.org, org. */
export function hostSuffixes(host: string): string[] {
  const labels = host.split('.');
  return labels.map((_, index) => labels.slice(index).join('.'));
}

/** Follow merged_into_organization_id to the surviving organization. Cycle-safe. */
export function resolveMergedOrganization(
  organizationId: string,
  mergedInto: ReadonlyMap<string, string | null>,
): string {
  const seen = new Set<string>();
  let current = organizationId;
  while (!seen.has(current)) {
    seen.add(current);
    const next = mergedInto.get(current);
    if (!next) return current;
    current = next;
  }
  throw new Error(`merged_into_organization_id cycle at ${organizationId}`);
}

export function parseReleaseClaim(value: unknown): ReleaseClaim | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as JsonRecord;
  const text = (key: string): string | null => {
    const entry = record[key];
    return typeof entry === 'string' && entry.trim() !== '' ? entry : null;
  };
  const id = text('id');
  const predicate = text('predicate');
  const object = text('object');
  const citationHref = text('citationHref');
  const citationLabel = text('citationLabel');
  const citationSource = text('citationSource');
  const confidenceLevel = text('confidenceLevel');
  if (!id || !predicate || !object || !citationHref || !citationLabel || !citationSource) {
    return null;
  }
  if (!confidenceLevel) return null;
  return {
    id,
    predicate,
    object,
    claimRole: text('claimRole'),
    citationHref,
    citationLabel,
    citationSource,
    confidenceLevel,
  };
}

function byId<T extends { id: string }>(left: T, right: T): number {
  return left.id.localeCompare(right.id);
}

// --- Planner ----------------------------------------------------------------------------------

export function buildBackfillPlan(snapshot: PlanSnapshot): BackfillPlan {
  const { releaseId, existingGeneratedIds: existing } = snapshot;

  const mergedInto = new Map(
    snapshot.organizations.map((org) => [org.id, org.mergedIntoOrganizationId] as const),
  );
  const survivor = (id: string): string => resolveMergedOrganization(id, mergedInto);

  // Evidence sources grouped by surviving organization, with item totals per organization.
  const sourcesByOrg = new Map<string, SnapshotSource[]>();
  const orgItemCount = new Map<string, number>();
  for (const source of snapshot.sources) {
    if (!source.organizationId) continue;
    const orgId = survivor(source.organizationId);
    const list = sourcesByOrg.get(orgId) ?? [];
    list.push(source);
    sourcesByOrg.set(orgId, list);
    orgItemCount.set(orgId, (orgItemCount.get(orgId) ?? 0) + source.itemCount);
  }

  // www-stripped hostname -> surviving organization ids (several when hostnames collide after
  // stripping, e.g. www.x.org and x.org registered to different organizations).
  const domainIndex = new Map<string, { orgIds: Set<string>; hostname: string }>();
  for (const domain of snapshot.domains) {
    const key = stripWww(domain.hostname);
    const entry = domainIndex.get(key) ?? { orgIds: new Set<string>(), hostname: domain.hostname };
    entry.orgIds.add(survivor(domain.organizationId));
    domainIndex.set(key, entry);
  }

  const ambiguous = new Map<string, { host: string; organizationIds: string[]; chosen: string }>();
  const matchOrganization = (
    host: string,
  ): { orgId: string; hostname: string; viaMerge: boolean } | null => {
    for (const suffix of hostSuffixes(host)) {
      const entry = domainIndex.get(suffix);
      if (!entry) continue;
      const orgIds = [...entry.orgIds].sort((left, right) => {
        const diff = (orgItemCount.get(right) ?? 0) - (orgItemCount.get(left) ?? 0);
        return diff !== 0 ? diff : left.localeCompare(right);
      });
      const chosen = orgIds[0]!;
      if (orgIds.length > 1) {
        ambiguous.set(suffix, { host: suffix, organizationIds: orgIds, chosen });
      }
      const rawOrgIds = snapshot.domains
        .filter((domain) => stripWww(domain.hostname) === suffix)
        .map((domain) => domain.organizationId);
      return { orgId: chosen, hostname: entry.hostname, viaMerge: !rawOrgIds.includes(chosen) };
    }
    return null;
  };

  // Parse every entity's claims first so hosts can be minted in a deterministic order.
  type ParsedEntity = {
    entity: SnapshotEntity;
    claims: ReleaseClaim[];
    blocked: string[];
  };
  const seenClaimIds = new Map<string, string>();
  const parsedEntities: ParsedEntity[] = [...snapshot.entities]
    .sort((left, right) => left.entityId.localeCompare(right.entityId))
    .map((entity) => {
      const blocked: string[] = [];
      if (!entity.canonicalEntityExists) {
        blocked.push('no bb_canonical.entities row (claims.entity_id FK would fail)');
      }
      const raw = Array.isArray(entity.claims) ? entity.claims : null;
      if (!raw || raw.length === 0) blocked.push('public claims value is not a non-empty array');
      const claims: ReleaseClaim[] = [];
      for (const [index, value] of (raw ?? []).entries()) {
        const claim = parseReleaseClaim(value);
        if (!claim) {
          blocked.push(`claim[${index}] is missing a required field`);
          continue;
        }
        if (!normalizeHost(claim.citationHref)) {
          blocked.push(`${claim.id}: citationHref is not an http(s) URL`);
        }
        if (snapshot.existingClaimIds.has(claim.id)) {
          blocked.push(`${claim.id}: id already exists in bb_canonical.claims`);
        }
        const owner = seenClaimIds.get(claim.id);
        if (owner !== undefined) {
          blocked.push(`${claim.id}: id also published on ${owner}`);
        } else {
          seenClaimIds.set(claim.id, entity.entityId);
        }
        claims.push(claim);
      }
      claims.sort(byId);
      return { entity, claims, blocked };
    });

  // Mint organizations for unmatched hosts, shortest first, so archives.x.edu lands on x.edu
  // when both are unmatched in this run.
  const firstHrefByHost = new Map<string, string>();
  for (const parsed of parsedEntities) {
    if (parsed.blocked.length > 0) continue;
    for (const claim of parsed.claims) {
      const host = normalizeHost(claim.citationHref)!;
      const current = firstHrefByHost.get(host);
      if (current === undefined || claim.citationHref < current) {
        firstHrefByHost.set(host, claim.citationHref);
      }
    }
  }
  const newOrganizations = new Map<string, OrganizationInsert>();
  const newDomains = new Map<string, DomainInsert>();
  const unmatchedHosts: string[] = [];
  const hostsShortestFirst = [...firstHrefByHost.keys()].sort((left, right) => {
    const diff = left.split('.').length - right.split('.').length;
    return diff !== 0 ? diff : left.localeCompare(right);
  });
  for (const host of hostsShortestFirst) {
    if (matchOrganization(host)) continue;
    unmatchedHosts.push(host);
    const orgId = stableId('org_web', host);
    const domainId = stableId('dom_web', host);
    if (!existing.organizations.has(orgId)) {
      newOrganizations.set(orgId, {
        id: orgId,
        name: host,
        homepage: new URL(firstHrefByHost.get(host)!).origin,
      });
    }
    if (!existing.domains.has(domainId)) {
      newDomains.set(domainId, { id: domainId, organization_id: orgId, hostname: host });
    }
    domainIndex.set(host, { orgIds: new Set([orgId]), hostname: host });
  }
  const mintedOrgIds = new Set(unmatchedHosts.map((host) => stableId('org_web', host)));

  // Shared rows accumulate across entities; a blocked entity contributes nothing.
  const newSources = new Map<string, EvidenceSourceInsert>();
  const newItems = new Map<string, SourceItemInsert>();
  const newEvidence = new Map<string, EvidenceRecordInsert>();
  const reusedSources = new Set<string>();
  const reusedItems = new Set<string>();
  const reusedEvidence = new Set<string>();
  const matchedOrgs = new Set<string>();

  const itemsBySourceAndIdentifier = new Map<string, SnapshotItem>();
  const itemsByUrl = new Map<string, SnapshotItem[]>();
  for (const item of [...snapshot.items].sort(byId)) {
    itemsBySourceAndIdentifier.set(`${item.sourceId}\n${item.stableIdentifier}`, item);
    for (const key of new Set([item.url, item.stableIdentifier])) {
      if (!key) continue;
      const list = itemsByUrl.get(key) ?? [];
      list.push(item);
      itemsByUrl.set(key, list);
    }
  }
  const sourceOrg = new Map(
    snapshot.sources.map((source) => [
      source.id,
      source.organizationId ? survivor(source.organizationId) : null,
    ]),
  );
  const evidenceByItem = new Map<string, SnapshotEvidence[]>();
  for (const record of [...snapshot.evidence].sort(byId)) {
    const list = evidenceByItem.get(record.sourceItemId) ?? [];
    list.push(record);
    evidenceByItem.set(record.sourceItemId, list);
  }

  const entityPlans: EntityPlan[] = [];
  for (const parsed of parsedEntities) {
    const { entity, claims } = parsed;
    const blocked = [...parsed.blocked];
    const claimRows: ClaimInsert[] = [];
    const versionRows: ClaimVersionInsert[] = [];
    const linkRows: ClaimEvidenceLinkInsert[] = [];
    const resolutions: ClaimResolution[] = [];

    // Stage shared rows locally so a block discovered mid-entity leaves no trace.
    const stagedSources = new Map<string, EvidenceSourceInsert>();
    const stagedItems = new Map<string, SourceItemInsert>();
    const stagedEvidence = new Map<string, EvidenceRecordInsert>();

    if (blocked.length === 0) {
      for (const claim of claims) {
        const host = normalizeHost(claim.citationHref)!;
        const match = matchOrganization(host);
        if (!match) throw new Error(`unreachable: host ${host} has no organization after minting`);
        const orgId = match.orgId;
        const orgResolution: ClaimResolution['organizationResolution'] = mintedOrgIds.has(orgId)
          ? 'new_in_run'
          : match.viaMerge
            ? 'matched_via_merge'
            : 'matched';

        // Evidence source: the organization's source with the most items, else mint one.
        const candidates = [...(sourcesByOrg.get(orgId) ?? [])].sort((left, right) =>
          right.itemCount !== left.itemCount
            ? right.itemCount - left.itemCount
            : left.id.localeCompare(right.id),
        );
        let sourceId: string;
        let sourceResolution: ClaimResolution['sourceResolution'];
        if (candidates[0]) {
          sourceId = candidates[0].id;
          sourceResolution = 'reused';
        } else {
          const orgHost = [...domainIndex.entries()].find(([, entry]) =>
            entry.orgIds.has(orgId),
          )?.[0];
          const displayName = orgHost ?? host;
          sourceId = stableId('src_web', [displayName, displayName]);
          sourceResolution = existing.sources.has(sourceId) ? 'reused' : 'new';
          if (sourceResolution === 'new' && !newSources.has(sourceId)) {
            stagedSources.set(sourceId, {
              id: sourceId,
              organization_id: orgId,
              display_name: displayName,
              adapter_id: BACKFILL_ACTOR,
              rights: {
                status: 'unknown',
                citationOnly: true,
                note: 'Rights and reuse terms were not present in the public release projection.',
              },
            });
          }
        }

        // Source item: (source, stable_identifier), then url, then mint.
        const href = claim.citationHref;
        let itemId: string;
        let itemResolution: ClaimResolution['sourceItemResolution'];
        const sameSource = itemsBySourceAndIdentifier.get(`${sourceId}\n${href}`);
        if (sameSource) {
          itemId = sameSource.id;
          itemResolution = 'reused_same_source';
        } else {
          const byUrl = [...(itemsByUrl.get(href) ?? [])].sort((left, right) => {
            const rank = (item: SnapshotItem): number =>
              item.sourceId === sourceId ? 0 : sourceOrg.get(item.sourceId) === orgId ? 1 : 2;
            const diff = rank(left) - rank(right);
            return diff !== 0 ? diff : left.id.localeCompare(right.id);
          });
          if (byUrl[0]) {
            itemId = byUrl[0].id;
            itemResolution = 'reused_by_url';
          } else {
            itemId = stableId('item_web', [sourceId, href]);
            itemResolution = 'new';
            if (existing.items.has(itemId)) {
              blocked.push(`${claim.id}: minted source item id ${itemId} already exists`);
            } else if (!newItems.has(itemId)) {
              stagedItems.set(itemId, {
                id: itemId,
                source_id: sourceId,
                stable_identifier: href,
                title: claim.citationLabel,
                url: href,
                metadata: {
                  citationSource: claim.citationSource,
                  importedFromRelease: releaseId,
                  importMethod: BACKFILL_METHOD,
                  sourceCapturePresent: false,
                },
              });
            }
          }
        }

        // Evidence record: the convergence id for this item, else an excerpt-free record on it,
        // else mint. A record carrying another claim's excerpt is not reused.
        const mintedEvidenceId = stableId('ev_web', itemId);
        const onItem = evidenceByItem.get(itemId) ?? [];
        const reusable =
          onItem.find((record) => record.id === mintedEvidenceId) ??
          onItem.find((record) => !record.excerpt || record.excerpt.trim() === '');
        let evidenceId: string;
        let evidenceResolution: ClaimResolution['evidenceResolution'];
        if (reusable) {
          evidenceId = reusable.id;
          evidenceResolution = 'reused';
        } else {
          evidenceId = mintedEvidenceId;
          evidenceResolution = 'new';
          if (existing.evidence.has(evidenceId)) {
            blocked.push(`${claim.id}: minted evidence id ${evidenceId} exists on another item`);
          } else if (!newEvidence.has(evidenceId)) {
            stagedEvidence.set(evidenceId, {
              id: evidenceId,
              source_item_id: itemId,
              rights_status: 'unknown',
              excerpt: null,
              lineage_root_id: evidenceId,
              metadata: {
                citationLabel: claim.citationLabel,
                importedFromRelease: releaseId,
                importMethod: BACKFILL_METHOD,
                sourceCapturePresent: false,
                supportingExcerptPresent: false,
              },
            });
          }
        }

        const body = {
          citation: {
            source: claim.citationSource,
            href: claim.citationHref,
            label: claim.citationLabel,
          },
          provenance: {
            method: BACKFILL_METHOD,
            releaseId,
            ...(claim.claimRole ? { claimRole: claim.claimRole } : {}),
          },
          limitations: {
            sourceCapturePresent: false,
            supportingExcerptPresent: false,
            note: 'The public projection retained the citation reference but not a captured source body or supporting excerpt.',
          },
        };
        const versionId = stableId('clv', [
          claim.id,
          entity.entityId,
          claim.predicate,
          claim.object,
          body,
        ]);
        const linkId = stableId('cel', [claim.id, versionId, evidenceId, 'supporting']);
        if (existing.claimVersions.has(versionId)) {
          blocked.push(`${claim.id}: claim version id ${versionId} already exists`);
        }
        if (existing.links.has(linkId)) {
          blocked.push(`${claim.id}: claim evidence link id ${linkId} already exists`);
        }
        const confidence = { level: claim.confidenceLevel, source: 'published_projection' };

        claimRows.push({
          id: claim.id,
          entity_id: entity.entityId,
          current_version_id: versionId,
          claim_class: 'standard',
          workflow_status: 'accepted',
          publication_status: 'published',
          procedural_status: 'ruled',
          confidence,
          research_coverage: {
            level: entity.researchCoverage ?? 'unknown',
            source: 'published_projection',
          },
          verification: {
            status: 'legacy_published_projection',
            releaseId,
            citationReferencePresent: true,
            sourceCapturePresent: false,
            supportingExcerptPresent: false,
          },
        });
        versionRows.push({
          id: versionId,
          claim_id: claim.id,
          predicate: claim.predicate,
          object: claim.object,
          workflow_status: 'accepted',
          publication_status: 'published',
          confidence,
          body,
          created_by: BACKFILL_ACTOR,
        });
        linkRows.push({
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
        resolutions.push({
          claimId: claim.id,
          host,
          organizationId: orgId,
          organizationResolution: orgResolution,
          matchedDomainHostname: orgResolution === 'new_in_run' ? null : match.hostname,
          sourceId,
          sourceResolution: sourceResolution === 'new' ? 'new' : 'reused',
          sourceItemId: itemId,
          sourceItemResolution: itemResolution,
          evidenceId,
          evidenceResolution,
        });
      }
    }

    if (blocked.length > 0) {
      entityPlans.push({
        entityId: entity.entityId,
        kind: entity.kind,
        blocked,
        claims: [],
        claimVersions: [],
        links: [],
        resolutions: [],
      });
      continue;
    }

    for (const [id, row] of stagedSources) newSources.set(id, row);
    for (const [id, row] of stagedItems) newItems.set(id, row);
    for (const [id, row] of stagedEvidence) newEvidence.set(id, row);
    for (const resolution of resolutions) {
      if (resolution.organizationResolution !== 'new_in_run') {
        matchedOrgs.add(resolution.organizationId);
      }
      if (!newSources.has(resolution.sourceId)) reusedSources.add(resolution.sourceId);
      if (!newItems.has(resolution.sourceItemId)) reusedItems.add(resolution.sourceItemId);
      if (!newEvidence.has(resolution.evidenceId)) reusedEvidence.add(resolution.evidenceId);
    }
    entityPlans.push({
      entityId: entity.entityId,
      kind: entity.kind,
      blocked: [],
      claims: claimRows,
      claimVersions: versionRows,
      links: linkRows,
      resolutions,
    });
  }

  // Minted organizations and domains are only kept when an unblocked entity uses them.
  const usedOrgIds = new Set(
    entityPlans.flatMap((plan) => plan.resolutions.map((resolution) => resolution.organizationId)),
  );
  const organizations = [...newOrganizations.values()].filter((row) => usedOrgIds.has(row.id));
  const domains = [...newDomains.values()].filter((row) => usedOrgIds.has(row.organization_id));
  const usedUnmatchedHosts = unmatchedHosts.filter((host) =>
    usedOrgIds.has(stableId('org_web', host)),
  );

  const planned = entityPlans.filter((plan) => plan.blocked.length === 0);
  const count = (select: (plan: EntityPlan) => readonly unknown[]): number =>
    planned.reduce((total, plan) => total + select(plan).length, 0);

  return {
    releaseId,
    entities: entityPlans,
    organizations: organizations.sort(byId),
    domains: domains.sort(byId),
    evidenceSources: [...newSources.values()].sort(byId),
    sourceItems: [...newItems.values()].sort(byId),
    evidenceRecords: [...newEvidence.values()].sort(byId),
    ambiguousHosts: [...ambiguous.values()].sort((left, right) =>
      left.host.localeCompare(right.host),
    ),
    unmatchedHosts: usedUnmatchedHosts,
    totals: {
      entitiesInScope: snapshot.entities.length,
      entitiesPlanned: planned.length,
      entitiesBlocked: entityPlans.length - planned.length,
      claims: count((plan) => plan.claims),
      claimVersions: count((plan) => plan.claimVersions),
      links: count((plan) => plan.links),
      evidenceRecordsReused: reusedEvidence.size,
      evidenceRecordsNew: newEvidence.size,
      sourceItemsReused: reusedItems.size,
      sourceItemsNew: newItems.size,
      evidenceSourcesReused: reusedSources.size,
      evidenceSourcesNew: newSources.size,
      organizationsMatched: matchedOrgs.size,
      organizationsNew: organizations.length,
      domainsNew: domains.length,
      hostsUnmatched: usedUnmatchedHosts.length,
      hostsAmbiguous: ambiguous.size,
      claimsResolvedViaMerge: planned
        .flatMap((plan) => plan.resolutions)
        .filter((resolution) => resolution.organizationResolution === 'matched_via_merge').length,
    },
  };
}

/** Every id the planner minted, so the caller can check which already exist. */
export function collectGeneratedIds(plan: BackfillPlan): {
  organizations: string[];
  domains: string[];
  sources: string[];
  items: string[];
  evidence: string[];
  claimVersions: string[];
  links: string[];
} {
  return {
    organizations: plan.organizations.map((row) => row.id),
    domains: plan.domains.map((row) => row.id),
    sources: plan.evidenceSources.map((row) => row.id),
    items: plan.sourceItems.map((row) => row.id),
    evidence: plan.evidenceRecords.map((row) => row.id),
    claimVersions: plan.entities.flatMap((entity) => entity.claimVersions.map((row) => row.id)),
    links: plan.entities.flatMap((entity) => entity.links.map((row) => row.id)),
  };
}
