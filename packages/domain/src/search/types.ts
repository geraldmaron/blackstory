/**
 * Public search domain types (BB-049).
 *
 * These are the pure, testable shapes the search index is built from and the search pipeline
 * produces. Nothing here exposes a raw relevance score, an evidence count, or any other numeric
 * ranking signal to end users: the only numeric fields (`relatedCount`, `claimCount`) live on the
 * server-internal record/index-doc shapes as ordering inputs and are explicitly NEVER carried into
 * the client-facing `SearchResultView` (see the field comments below). This mirrors BB-092's rule
 * that adjacency `evidenceCount` is an internal ordering key only, never a public payload field.
 */
import type { NotabilityBasisRecord } from '../entity-status.js';

/**
 * The domain-layer input record the search index is built FROM.
 *
 * Structurally compatible with `apps/web`'s `PublicEntityView` (a sibling agent adapts
 * `PublicEntityView` -> this record in a later tranche; the domain package cannot import from
 * `apps/web`, so this type is defined here and its field names deliberately mirror
 * `PublicEntityView`'s so that adapter is trivial). `aliases` are already-lowercased flat strings:
 * the caller extracts them from the real `EntityAlias[]` (whose alias text lives on the `.value`
 * field, with `kind: 'former_name' | 'aka' | 'spelling' | 'translated' | 'other'`) and lowercases
 * them; this type consumes flat strings only, so it never depends on the `EntityAlias` shape.
 */
export type SearchableEntityRecord = {
  readonly id: string;
  readonly kind: string;
  readonly displayName: string;
  /** Lowercased `displayName`, precomputed once for query-time matching. */
  readonly nameLower: string;
  /** Lowercased alias strings, already extracted+flattened from `EntityAlias[]` by the caller. */
  readonly aliases: readonly string[];
  readonly summary?: string;
  readonly topicTags: readonly string[];
  /** State-level jurisdiction label (BB-090), used by the `state` facet + filter. */
  readonly jurisdictionState?: string;
  /** Derived current lifecycle status (BB-090) — never hand-edited; used by the `status` filter. */
  readonly status?: string;
  /** Decade labels the entity's dated span overlaps (BB-090), used by the `era` filter. */
  readonly eraBuckets: readonly string[];
  /**
   * Auditable inclusion basis records (BB-090). Required on this build-input shape so
   * `buildPublicSearchIndexDocs` can independently enforce the notability gate at the search
   * boundary (BB-049 AC5) as defense-in-depth. Carries only string leaves (criterion, note,
   * evidenceIds) — never a numeric score.
   */
  readonly notabilityBasis: readonly NotabilityBasisRecord[];
  /** Human-readable notability rubric labels (never a raw criterion id alone, never a score). */
  readonly notabilityLabels: readonly string[];
  readonly sensitivityClass?: string;
  readonly recordMaturity: string;
  readonly researchCoverage: 'minimal' | 'partial' | 'substantial';
  /**
   * Connection-strength proxy (count of related/adjacency entries). A SERVER-INTERNAL ordering
   * input only: it nudges/breaks ties in ranking (BB-049 AC1 "ranked by relevance and connection
   * strength, not fame alone") but is NEVER projected into `SearchResultView` or any client
   * payload — mirroring BB-092's adjacency `evidenceCount` policy.
   */
  readonly relatedCount: number;
  /** Server-internal supporting-claim count. Same policy as `relatedCount`: never client-facing. */
  readonly claimCount: number;
};

/**
 * The Firestore-persisted search index document (BB-049).
 *
 * A structural superset of `SearchableEntityRecord` (all of its fields plus `releaseId`), so a
 * `PublicSearchIndexDoc` can be passed anywhere a `SearchableEntityRecord` is expected without a
 * cast — that is what lets `runPublicSearch` reuse the pure `applyFilters` / `rankRecords` helpers
 * directly. This doc is read SERVER-SIDE only: its numeric ranking inputs (`relatedCount`,
 * `claimCount`) and raw `notabilityBasis` never reach the client, which only ever sees
 * `SearchResultView`.
 */
export type PublicSearchIndexDoc = SearchableEntityRecord & {
  readonly releaseId: string;
};

/**
 * Faceted-search aggregate counts. Each map is `value -> count`. The count integers are
 * navigational aggregates for the facet sidebar (how many results carry each value), not a per-
 * record ranking score.
 */
export type SearchFacetCounts = {
  readonly kind: Record<string, number>;
  readonly status: Record<string, number>;
  readonly era: Record<string, number>;
  readonly theme: Record<string, number>;
  readonly state: Record<string, number>;
  readonly recordMaturity: Record<string, number>;
  readonly researchCoverage: Record<string, number>;
};

/** Which field a query matched on — determines the explanation text. */
export type SearchMatchField = 'displayName' | 'alias' | 'summary' | 'topicTags';

/**
 * A single client-facing search result. Deliberately carries NO numeric relevance score, NO
 * evidence/connection count, and NO redacted field — only display-safe text (BB-049 AC4: results
 * indicate WHY they match, in words, not a number).
 */
export type SearchResultView = {
  readonly id: string;
  readonly kind: string;
  readonly displayName: string;
  readonly summary?: string;
  readonly matchedOn: SearchMatchField;
  readonly matchedText: string;
  readonly explanation: string;
  readonly status?: string;
  readonly eraBuckets: readonly string[];
  readonly notabilityLabels: readonly string[];
  readonly sensitivityClass?: string;
};

/** The 6 allowlisted filter fields (BB-049 + BB-090 status/era additions). */
export type SearchFilterField = 'kind' | 'state' | 'precision' | 'releaseId' | 'status' | 'era';

export type SearchFilter = {
  readonly field: SearchFilterField;
  readonly value: string;
};

/** Sort modes (BB-049). `relevance` is the default text-relevance + connection-strength order. */
export type SearchSort =
  | 'relevance'
  | 'name_asc'
  | 'name_desc'
  | 'date_asc'
  | 'date_desc'
  | 'distance';

/**
 * Fully-normalized search execution input. `offset`/`pageSize` are computed upstream by the route
 * from BB-026's cursor depth — this layer just consumes them.
 */
export type SearchExecutionInput = {
  readonly normalizedQuery: string;
  readonly filters: readonly SearchFilter[];
  readonly sort: SearchSort;
  readonly offset: number;
  readonly pageSize: number;
};

export type SearchExecutionResult = {
  readonly results: readonly SearchResultView[];
  readonly facets: SearchFacetCounts;
  readonly totalMatched: number;
  readonly hasMore: boolean;
};
