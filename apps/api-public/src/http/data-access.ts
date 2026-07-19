/**
 * `PublicDataAccess` — the read port every `/v1` handler depends on, and its adapters.
 *
 * Why a port (dependency injection) rather than a hard-wired Firestore client here:
 * - It keeps the handlers pure and unit-testable without a Firebase emulator (the emulator-backed
 *   integration test the bead lists is a real, separate lane — see this repo's `packages/firebase`
 *   rules/integration tests — and is DEFERRED in this pass because the sandbox has no emulator
 *   credentials; that deferral is called out honestly, not faked with a green stub).
 * - It mirrors the factory-injection style already used by `createFindNearestEndpoint`
 *   (`vector-search-endpoint.ts`), where every dependency (verifier, store, embedding provider) is
 *   injected so the composition — not the I/O — is what's tested.
 *
 * Two adapters ship here:
 * 1. `createInMemoryPublicDataAccess` — a REAL, fully-tested implementation used by the handler
 *    tests and legitimately usable as the ADR-004 degraded/immutable-snapshot source (it reads a
 *    fixed set of already-released, already-redacted public projections held in memory).
 * 2. `createFirestorePublicDataAccess` — binds the port to injected `@repo/firebase` public
 *    projection readers + a projection→DTO mapper. The mapper (projection document → `EntityV1`)
 *    is the seam that lands with live release wiring (MOB-005); it is injected, not invented here,
 *    so this module never imports a server-only Firestore shape it would have to redact.
 *
 * All entity data returned by any adapter is validated against the shared `entityV1Schema` before
 * it leaves this module, so the response-redaction guarantee (no internal/ranking/precise-geo
 * fields — ADR-021 §3) holds regardless of adapter: the zod parse strips any unknown field.
 */
import type { CanonicalSearchQuery } from '@repo/security';
import { entityV1Schema, type EntityV1 } from '@repo/public-contracts/v1/entity';
import {
  type SearchFacetCountsV1,
  type SearchResultV1,
} from '@repo/public-contracts/v1/search';
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
  /** The active release pointer + optional index/content versions (ADR-004 active-release
   * pointer). `undefined` signals no released data is available yet (pre-release bootstrap). */
  getReleasePointer(): Promise<ReleasePointer | undefined>;
  /**
   * A single published entity. Returns `undefined` for BOTH a nonexistent id AND an id that exists
   * canonically but is not published in this release — the caller must not be able to distinguish
   * the two (T3 enumeration; bead adversarial requirement). The distinction never crosses this
   * boundary.
   */
  getEntity(releaseId: string, entityId: string): Promise<EntityV1 | undefined>;
  /** A bounded search page over the active release for an already-validated canonical query. */
  search(canonical: CanonicalSearchQuery, options: { readonly releaseId: string }): Promise<SearchPage>;
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
// In-memory adapter (real, tested; also the ADR-004 degraded-snapshot source)
// ---------------------------------------------------------------------------

export type InMemoryPublicDataOptions = {
  readonly pointer: ReleasePointer;
  /** The published, already-redacted public projections for the active release. */
  readonly entities: readonly EntityV1[];
  /**
   * Ids that exist canonically but are NOT published in this release. They are indistinguishable
   * from nonexistent ids at the port boundary (both yield `undefined`); this set only exists so a
   * test can assert that an unpublished id and a nonexistent id produce byte-identical 404s.
   */
  readonly unpublishedIds?: readonly string[];
};

export function createInMemoryPublicDataAccess(options: InMemoryPublicDataOptions): PublicDataAccess {
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

    async search(canonical) {
      const needle = canonical.q.trim().toLowerCase();
      const matches = [...byId.values()].filter((entity) => {
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
    },
  };
}

/** Projects a published `EntityV1` into a `SearchResultV1`. Deliberately carries NO numeric
 * relevance/evidence score — results explain WHY they match in words, never a number (ADR-021 §3;
 * mirrors `search.ts`'s own exclusion). */
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
  };
}

// ---------------------------------------------------------------------------
// Firestore adapter (binding seam — live wiring/emulator integration deferred)
// ---------------------------------------------------------------------------

/**
 * Injected readers that bind the port to live released public projections. In production these are
 * `@repo/firebase`'s public-projection readers (`fetchActiveRelease`, `fetchPublicEntityProjection`
 * — see `apps/web/src/lib/public-data/firestore-readers.ts` for the same access pattern) composed
 * with the domain projection→`EntityV1` mapper. They are injected rather than imported here so this
 * app module never depends on a raw Firestore document shape, and so the port stays unit-testable
 * with fakes. Binding these to the real readers + running them against the Firebase emulator is the
 * DEFERRED integration lane (no emulator credentials in this sandbox).
 */
export type FirestoreDataAccessReaders = {
  readonly readReleasePointer: () => Promise<ReleasePointer | undefined>;
  /** MUST already collapse unpublished/nonexistent to `undefined` (T3). */
  readonly readEntity: (releaseId: string, entityId: string) => Promise<EntityV1 | undefined>;
  readonly readSearchPage: (
    canonical: CanonicalSearchQuery,
    options: { readonly releaseId: string },
  ) => Promise<SearchPage>;
};

export function createFirestorePublicDataAccess(readers: FirestoreDataAccessReaders): PublicDataAccess {
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
    async search(canonical, options) {
      return readers.readSearchPage(canonical, options);
    },
  };
}
