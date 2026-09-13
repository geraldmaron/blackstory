/**
 * `PublicDataAccess` — the read port every `/v1` handler depends on, and its adapters.
 *
 * Why a port (dependency injection) rather than a hard-wired Postgres client here:
 * - It keeps the handlers pure and unit-testable without a live database.
 * - It mirrors the factory-injection style already used by `createFindNearestEndpoint`
 *   (`vector-search-endpoint.ts`), where every dependency (verifier, store, embedding provider) is
 *   injected so the composition — not the I/O — is what's tested.
 *
 * Two adapters ship here:
 * 1. `createInMemoryPublicDataAccess` — a REAL, fully-tested implementation used by the handler
 *    tests and usable as a degraded/immutable-snapshot source (it reads a fixed set of
 *    already-released, already-redacted public projections held in memory). It is not one today:
 *    `./compose.ts` builds it with `{ entities: [] }` when the live-Postgres gate fails, so an
 *    unconfigured deployment returns `UPSTREAM_UNAVAILABLE` rather than serving a snapshot. See
 *    `docs/decisions-carryover.md`, "Public projection and immutable publication snapshots".
 * 2. `createPublicDataAccessFromReaders` — binds the port to injected public projection readers + a
 *    projection→DTO mapper. The readers are injected, not invented here, so this module never
 *    imports a server-only storage shape it would have to redact; the concrete live binding (real
 *    Postgres `bb_public` reads + the projection→`EntityV1` mapper) lives in
 *    `./postgres-data-access.ts` and `./projection-mapping.ts`, and is selected at runtime by
 *    `./compose.ts` per `./live-policy.ts`'s live/fixture gate (the Postgres SoR cutover —
 *    `docs/decisions-carryover.md`, "entity source-of-truth precedence"; Postgres is
 *    the only live path — see that file's header for what remains a documented gap, e.g. `related`
 *    hydration and index-backed search).
 *
 * All entity data returned by any adapter is validated against the shared `entityV1Schema` before
 * it leaves this module, so the response-redaction guarantee (no internal/ranking field, and no
 * precision tier finer than `institution` — `docs/decisions-carryover.md`, "ADR-021's two
 * invariants": public-response redaction) holds regardless of adapter: the zod parse strips any
 * unknown field.
 */
import {
  runPublicSearch,
  type PublicSearchIndexDoc,
  type SearchExecutionResult,
} from '@repo/domain';
import type { CanonicalSearchQuery } from '@repo/security';
import { normalizeSearchText } from '@repo/security';
import { entityV1Schema, type EntityV1 } from '@repo/public-contracts/v1/entity';
import {
  confidenceTierFromEvidenceInputs,
  recordConfidenceTier,
  type ConfidenceTier,
} from '@repo/public-contracts/evidence';
import { type SearchFacetCountsV1, type SearchResultV1 } from '@repo/public-contracts/v1/search';
import type { RevisionMetadataV1 } from '@repo/public-contracts/v1/revision';

export type ReleasePointer = {
  readonly activeRelease: RevisionMetadataV1;
  readonly searchIndexVersion?: string;
  readonly contentVersion?: string;
};

/** One page of search results. The opaque `nextCursor` is NOT set here — it is minted by the
 * search handler from the guardrail's canonical query hash so it is cryptographically bound to the
 * query (T3 anti-scraping); an adapter only reports whether more results exist. */
export type SearchPage = {
  readonly results: readonly SearchResultV1[];
  readonly facets: SearchFacetCountsV1;
  readonly totalMatched: number;
  readonly hasMore: boolean;
};

export interface PublicDataAccess {
  /** The active release pointer + optional index/content versions. Exactly one release is active
   * at a time (`bb_public.active_release` is a single row). `undefined` signals no released data
   * is available yet (pre-release bootstrap). */
  getReleasePointer(): Promise<ReleasePointer | undefined>;
  /**
   * A single published entity. Returns `undefined` for BOTH a nonexistent id AND an id that exists
   * canonically but is not published in this release — the caller must not be able to distinguish
   * the two (T3 enumeration; bead adversarial requirement). The distinction never crosses this
   * boundary.
   */
  getEntity(releaseId: string, entityId: string): Promise<EntityV1 | undefined>;
  /**
   * The survivor id a merged-away entity id forwards to, or `undefined` (repo-n7p6.29).
   *
   * This is the ONE distinction the T3 indistinguishability rule above deliberately allows, and
   * only because the data behind it is published on purpose: `bb_public.release_entity_redirects`
   * holds nothing but absorbed ids that were already publicly resolvable, mapped to survivors
   * that are published now. It says nothing about any unpublished record — a withdrawn id and a
   * never-existed id both miss this lookup exactly the way they miss `getEntity`, so the
   * enumeration surface is unchanged. The handler calls it on EVERY miss, so the backend call
   * sequence stays identical across nonexistent, unpublished, and absorbed ids.
   */
  getEntityRedirect(releaseId: string, entityId: string): Promise<string | undefined>;
  /**
   * All published entities for a release (map FeatureCollection input). Bounded upstream by
   * adapter scan ceilings; callers must still validate the map payload against MapSourceV1.
   */
  listEntities(releaseId: string): Promise<readonly EntityV1[]>;
  /** A bounded search page over the active release for an already-validated canonical query. */
  search(
    canonical: CanonicalSearchQuery,
    options: { readonly releaseId: string },
  ): Promise<SearchPage>;
}

export const EMPTY_FACETS: SearchFacetCountsV1 = {
  kind: {},
  status: {},
  era: {},
  theme: {},
  state: {},
  recordMaturity: {},
  researchCoverage: {},
};

// ---------------------------------------------------------------------------
// In-memory adapter (real, tested; the degraded-snapshot shape, unpopulated in production)
// ---------------------------------------------------------------------------

export type InMemoryPublicDataOptions = {
  /**
   * Omit when no active release is configured — `getReleasePointer` then honestly reports
   * `undefined` (pre-release bootstrap) instead of fabricating one. This is the default
   * fallback `./compose.ts` uses when the runtime environment does not satisfy the live-Postgres
   * gate (`./live-policy.ts`): an unconfigured deployment returns `UPSTREAM_UNAVAILABLE` rather
   * than silently serving stale/fake sample data as if it were a real release.
   */
  readonly pointer?: ReleasePointer;
  /** The published, already-redacted public projections for the active release. */
  readonly entities: readonly EntityV1[];
  /**
   * Ids that exist canonically but are NOT published in this release. They are indistinguishable
   * from nonexistent ids at the port boundary (both yield `undefined`); this set only exists so a
   * test can assert that an unpublished id and a nonexistent id produce byte-identical 404s.
   */
  readonly unpublishedIds?: readonly string[];
  /**
   * Published absorbed→survivor redirects for this release, as `{ [absorbedId]: survivorId }`.
   * Mirrors `bb_public.release_entity_redirects`; values are already terminal survivors, so a
   * chain is never walked here either.
   */
  readonly redirects?: Readonly<Record<string, string>>;
};

export function createInMemoryPublicDataAccess(
  options: InMemoryPublicDataOptions,
): PublicDataAccess {
  // Validate on construction so a malformed fixture can never leak an unredacted field at read time.
  const byId = new Map<string, EntityV1>();
  for (const entity of options.entities) {
    byId.set(entity.id, entityV1Schema.parse(entity));
  }

  return {
    async getReleasePointer() {
      return options.pointer;
    },

    async getEntity(_releaseId, entityId) {
      // Both unpublished and nonexistent collapse to `undefined` — no distinguishing signal.
      return byId.get(entityId);
    },

    async getEntityRedirect(_releaseId, entityId) {
      return options.redirects?.[entityId];
    },

    async listEntities(_releaseId) {
      return [...byId.values()];
    },

    async search(canonical) {
      return searchOverEntities([...byId.values()], canonical);
    },
  };
}

/**
 * Substring match + cursor-offset pagination over an already-loaded entity array. Used by the
 * in-memory adapter and as a bounded safety-net fallback when live Postgres has no
 * `publicSearchIndex` rows for the active release (`./postgres-data-access.ts`). Does not apply
 * facet filters or domain ranking — only free-text `q` on displayName/summary.
 */
export function searchOverEntities(
  entities: readonly EntityV1[],
  canonical: CanonicalSearchQuery,
): SearchPage {
  const needle = canonical.q.trim().toLowerCase();
  const matches = entities.filter((entity) => {
    if (needle.length === 0) return true;
    return (
      entity.displayName.toLowerCase().includes(needle) ||
      entity.summary.toLowerCase().includes(needle)
    );
  });

  const offset = (canonical.depth - 1) * canonical.pageSize;
  const pageEntities = matches.slice(offset, offset + canonical.pageSize);
  const results: SearchResultV1[] = pageEntities.map((entity) => toSearchResult(entity, needle));

  return {
    results,
    facets: EMPTY_FACETS,
    totalMatched: matches.length,
    hasMore: offset + canonical.pageSize < matches.length,
  };
}

/**
 * Index-backed search via `@repo/domain`'s `runPublicSearch` (same pipeline as
 * `apps/web/src/app/search/api/handler.ts`). Applies facet filters, facets, ranking, and
 * depth-based pagination over persisted `publicSearchIndex` docs loaded by
 * `./postgres-data-access.ts`.
 */
export function searchOverIndex(
  index: readonly PublicSearchIndexDoc[],
  canonical: CanonicalSearchQuery,
): SearchPage {
  const execution = runPublicSearch(
    {
      normalizedQuery: normalizeSearchText(canonical.q),
      filters: [...canonical.filters],
      sort: canonical.sort,
      offset: (canonical.depth - 1) * canonical.pageSize,
      pageSize: canonical.pageSize,
    },
    index,
  );
  return mapSearchExecutionToPage(execution, tierReader(index));
}

/**
 * Grades a record from the INPUTS the index carries, at read time and only for the rows a page
 * actually returns.
 *
 * The index deliberately stores `evidenceInputs` and not a finished tier: a cached grade goes
 * stale the moment the rule changes, which is exactly what stranded `/records` on the web for a
 * day. Every surface — Explore, `/records`, the record page, and now a search row on the phone —
 * ends at the one `confidenceTierFromEvidenceInputs`, so a rule change reaches all of them in the
 * same deploy. A tier is never read out of the index; only the facts behind it are.
 *
 * Grading is deferred per result rather than swept over the whole index up front: a page returns
 * tens of rows out of thousands of docs, and the rule is not so cheap that running it on every
 * record to serve twenty is free. Building the id map is pointer work; running the rule is not.
 *
 * A doc published before `evidenceInputs` existed grades to `undefined`, so its result carries no
 * tier rather than a fabricated `unrated` — "we could not grade this" and "nobody assessed this"
 * are different claims.
 */
function tierReader(
  index: readonly PublicSearchIndexDoc[],
): (id: string) => ConfidenceTier | undefined {
  const byId = new Map(index.map((doc) => [doc.id, doc]));
  return (id) => {
    const inputs = byId.get(id)?.evidenceInputs;
    return inputs === undefined ? undefined : confidenceTierFromEvidenceInputs(inputs);
  };
}

/** Omits the key entirely when the record could not be graded, rather than emitting `undefined`. */
function tierField(tier: ConfidenceTier | undefined): { confidenceTier?: ConfidenceTier } {
  return tier === undefined ? {} : { confidenceTier: tier };
}

function mapSearchExecutionToPage(
  execution: SearchExecutionResult,
  readTier: (id: string) => ConfidenceTier | undefined = () => undefined,
): SearchPage {
  const results: SearchResultV1[] = execution.results.map((result) => ({
    id: result.id,
    kind: result.kind,
    displayName: result.displayName,
    ...(result.summary !== undefined ? { summary: result.summary } : {}),
    matchedOn: result.matchedOn,
    matchedText: result.matchedText,
    explanation: result.explanation,
    ...(result.status !== undefined ? { status: result.status } : {}),
    eraBuckets: [...result.eraBuckets],
    notabilityLabels: [...result.notabilityLabels],
    ...(result.sensitivityClass !== undefined ? { sensitivityClass: result.sensitivityClass } : {}),
    ...tierField(readTier(result.id)),
  }));

  return {
    results,
    facets: execution.facets,
    totalMatched: execution.totalMatched,
    hasMore: execution.hasMore,
  };
}

/** Projects a published `EntityV1` into a `SearchResultV1`. Deliberately carries NO numeric
 * relevance/evidence score — results explain WHY they match in words, never a number
 * (`docs/decisions-carryover.md`, "ADR-021's two invariants": public-response redaction; mirrors
 * `search.ts`'s own exclusion, and asserted by `redaction.test.ts`). The graded `confidenceTier`
 * below is an assessment, not a count, and is the one evidence signal this shape carries. */
function toSearchResult(entity: EntityV1, needle: string): SearchResultV1 {
  const matchedInName = needle.length === 0 || entity.displayName.toLowerCase().includes(needle);
  return {
    id: entity.id,
    kind: entity.kind,
    displayName: entity.displayName,
    ...(entity.summary ? { summary: entity.summary.slice(0, 2000) } : {}),
    matchedOn: matchedInName ? 'displayName' : 'summary',
    matchedText: (matchedInName ? entity.displayName : entity.summary).slice(0, 2000),
    explanation: entity.relevanceExplanation.slice(0, 1000),
    ...(entity.status ? { status: entity.status } : {}),
    eraBuckets: entity.eraBuckets ?? [],
    notabilityLabels: entity.notabilityLabels ?? [],
    ...(entity.sensitivityClass ? { sensitivityClass: entity.sensitivityClass } : {}),
    // A TIER, not a count. The claims are in hand on this path, so the same one rule
    // `/v1/map` and the record page apply grades the row here too.
    confidenceTier: recordConfidenceTier(entity.claims),
  };
}

// ---------------------------------------------------------------------------
// Postgres adapter (live wiring via `./postgres-data-access.ts` + `./compose.ts`)
// ---------------------------------------------------------------------------

/**
 * Injected readers that bind the port to live released public projections. In production these are
 * `./postgres-readers.ts`'s public-projection readers (`fetchActiveRelease`,
 * `fetchPublicEntityProjection` — see `apps/web/src/lib/public-data/postgres-readers.ts` for the
 * same access pattern) composed with `./projection-mapping.ts`'s projection→`EntityV1` mapper. They
 * are injected rather than imported here so this app module never depends on a raw storage document
 * shape, and so the port stays unit-testable with fakes. Live production wiring is selected at
 * runtime by `./live-policy.ts`.
 */
export type PublicDataAccessReaders = {
  readonly readReleasePointer: () => Promise<ReleasePointer | undefined>;
  /** MUST already collapse unpublished/nonexistent to `undefined` (T3). */
  readonly readEntity: (releaseId: string, entityId: string) => Promise<EntityV1 | undefined>;
  /** The published absorbed→survivor forward for this id, if any (repo-n7p6.29). */
  readonly readEntityRedirect: (releaseId: string, entityId: string) => Promise<string | undefined>;
  /** All published entities for map FeatureCollection construction. */
  readonly readEntities: (releaseId: string) => Promise<readonly EntityV1[]>;
  readonly readSearchPage: (
    canonical: CanonicalSearchQuery,
    options: { readonly releaseId: string },
  ) => Promise<SearchPage>;
};

export function createPublicDataAccessFromReaders(
  readers: PublicDataAccessReaders,
): PublicDataAccess {
  return {
    async getReleasePointer() {
      return readers.readReleasePointer();
    },
    async getEntity(releaseId, entityId) {
      const entity = await readers.readEntity(releaseId, entityId);
      // Re-validate at the boundary: even a live projection reader's output is parsed before it can
      // leave this module, so an accidental internal field can never reach a client.
      return entity ? entityV1Schema.parse(entity) : undefined;
    },
    async getEntityRedirect(releaseId, entityId) {
      return readers.readEntityRedirect(releaseId, entityId);
    },
    async listEntities(releaseId) {
      const entities = await readers.readEntities(releaseId);
      return entities.map((entity) => entityV1Schema.parse(entity));
    },
    async search(canonical, options) {
      return readers.readSearchPage(canonical, options);
    },
  };
}
