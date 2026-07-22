/**
 * Deterministic Firestore read-budget instrumentation for MOB-004 `/v1` endpoints.
 *
 * Exposes documented caps (`MAX_LIVE_SEARCH_SCAN`, `SEARCH_INDEX_PAGE_SIZE`, guardrail
 * pagination limits) and a recording Firestore fake that counts `doc().get()` and paginated
 * `collection().where().get()` operations. Used by `./firestore-read-budget.test.ts` to assert
 * worst-case read counts without a live emulator or flaky load tests.
 */
import { DEFAULT_QUERY_GUARDRAIL_LIMITS } from '@repo/security';
import type {
  FirestoreClientLike,
  FirestoreCollectionRefLike,
  FirestoreDocSnapshotLike,
  FirestoreQueryLike,
  FirestoreQuerySnapshotLike,
} from './firestore-data-access.js';
import {
  MAX_LIVE_SEARCH_SCAN,
  SEARCH_INDEX_PAGE_SIZE,
} from './firestore-data-access.js';

export { MAX_LIVE_SEARCH_SCAN, SEARCH_INDEX_PAGE_SIZE };

/** Query guardrail caps that bound in-memory pagination (not Firestore page fetches). */
export const SEARCH_GUARDRAIL_PAGE_SIZE_MAX = DEFAULT_QUERY_GUARDRAIL_LIMITS.maxPageSize;
export const SEARCH_GUARDRAIL_DEPTH_MAX = DEFAULT_QUERY_GUARDRAIL_LIMITS.maxPaginationDepth;

/** Maximum in-memory result window a single search request can slice (depth × pageSize). */
export const SEARCH_MAX_IN_MEMORY_WINDOW =
  SEARCH_GUARDRAIL_PAGE_SIZE_MAX * SEARCH_GUARDRAIL_DEPTH_MAX;

export type FirestoreReadTrace = {
  /** Count of `firestore.doc(path).get()` invocations (each counts as one billed doc read). */
  docGets: number;
  /** Count of paginated or limited `collection(...).get()` invocations. */
  queryGets: number;
  /** Sum of `snapshot.docs.length` across all query gets (each doc is one billed read). */
  queryDocumentsRead: number;
};

export function createEmptyFirestoreReadTrace(): FirestoreReadTrace {
  return { docGets: 0, queryGets: 0, queryDocumentsRead: 0 };
}

export function totalFirestoreDocumentsRead(trace: FirestoreReadTrace): number {
  return trace.docGets + trace.queryDocumentsRead;
}

export type EndpointReadBudget = {
  readonly docGets: number;
  readonly queryGets: number;
  readonly documentsRead: number;
};

/** Worst-case Firestore reads for `GET /v1/bootstrap` (live adapter). */
export const BOOTSTRAP_READ_BUDGET: EndpointReadBudget = {
  docGets: 1,
  queryGets: 0,
  documentsRead: 1,
};

/** Worst-case Firestore reads for `GET /v1/entity/:id` (live adapter). */
export const ENTITY_READ_BUDGET: EndpointReadBudget = {
  docGets: 2,
  queryGets: 0,
  documentsRead: 2,
};

/** Artifact-first search: release pointer doc only; index rows come from HTTPS artifact. */
export const SEARCH_ARTIFACT_READ_BUDGET: EndpointReadBudget = {
  docGets: 1,
  queryGets: 0,
  documentsRead: 1,
};

/** Computes worst-case Firestore reads when the full release index is loaded from Firestore. */
export function searchIndexBackedReadBudget(indexDocCount: number): EndpointReadBudget {
  const pages = indexDocCount === 0 ? 1 : Math.ceil(indexDocCount / SEARCH_INDEX_PAGE_SIZE);
  return {
    docGets: 1,
    queryGets: pages,
    documentsRead: 1 + indexDocCount,
  };
}

/** Computes worst-case Firestore reads for the bounded entity-collection fallback path. */
export function searchFallbackReadBudget(entityDocCount: number): EndpointReadBudget {
  const scanned = Math.min(entityDocCount, MAX_LIVE_SEARCH_SCAN);
  return {
    docGets: 1,
    queryGets: 2,
    documentsRead: 1 + scanned,
  };
}

export type RecordingFirestoreSeed = {
  readonly activeRelease?: unknown;
  readonly entities?: ReadonlyMap<string, unknown>;
  readonly searchIndex?: ReadonlyMap<string, unknown>;
};

/**
 * Hand-rolled Firestore fake that records every `doc().get()` and paginated index/entity query.
 * Structurally compatible with `FirestoreClientLike` for `createFirestoreDataAccessReaders`.
 */
export function createRecordingFirestoreClient(
  seed: RecordingFirestoreSeed,
  trace: FirestoreReadTrace,
): FirestoreClientLike {
  const entities = seed.entities ?? new Map<string, unknown>();
  const searchIndex = seed.searchIndex ?? new Map<string, unknown>();

  function docSnapshot(exists: boolean, data?: unknown, id?: string): FirestoreDocSnapshotLike {
    return {
      ...(id !== undefined ? { id } : {}),
      exists,
      data() {
        return data;
      },
    };
  }

  function buildSearchIndexQuery(releaseId: string): FirestoreQueryLike {
    let startAfterId: string | undefined;
    let pageLimit = SEARCH_INDEX_PAGE_SIZE;

    const self: FirestoreQueryLike = {
      where(field: string, op: '==', value: string) {
        if (field !== 'releaseId' || op !== '==' || value !== releaseId) {
          throw new Error(`unexpected index query filter: ${field} ${op} ${value}`);
        }
        return self;
      },
      orderBy(field: string) {
        if (field !== '__name__') {
          throw new Error(`unexpected index orderBy: ${field}`);
        }
        return self;
      },
      limit(count: number) {
        pageLimit = count;
        return self;
      },
      startAfter(snapshot: FirestoreDocSnapshotLike) {
        startAfterId = snapshot.id;
        return self;
      },
      async get(): Promise<FirestoreQuerySnapshotLike> {
        trace.queryGets += 1;
        const rows = [...searchIndex.entries()]
          .map(([id, data]) => ({ id, data }))
          .filter(({ data }) => {
            const parsed = data as { releaseId?: string };
            return parsed.releaseId === releaseId;
          })
          .sort((a, b) => a.id.localeCompare(b.id));

        const startIndex =
          startAfterId === undefined ? 0 : rows.findIndex((row) => row.id === startAfterId) + 1;
        const page = rows.slice(startIndex, startIndex + pageLimit);
        const docs = page.map(({ id, data }) => docSnapshot(true, data, id));
        trace.queryDocumentsRead += docs.length;
        return { empty: docs.length === 0, size: docs.length, docs };
      },
    };
    return self;
  }

  return {
    doc(path: string) {
      return {
        async get(): Promise<FirestoreDocSnapshotLike> {
          trace.docGets += 1;
          if (path.endsWith('/activeRelease')) {
            return seed.activeRelease === undefined
              ? docSnapshot(false)
              : docSnapshot(true, seed.activeRelease);
          }
          const entityId = path.split('/').at(-1) ?? '';
          const data = entities.get(entityId);
          return data === undefined ? docSnapshot(false) : docSnapshot(true, data);
        },
      };
    },
    collection(path: string): FirestoreCollectionRefLike {
      if (path === 'publicSearchIndex') {
        return {
          limit() {
            throw new Error('publicSearchIndex reads must use where/orderBy, not bare limit');
          },
          where(_field: string, _op: '==', releaseId: string) {
            return buildSearchIndexQuery(releaseId);
          },
        };
      }

      return {
        limit(count: number) {
          if (count !== MAX_LIVE_SEARCH_SCAN) {
            throw new Error(`unexpected entity scan limit: ${count}`);
          }
          return {
            async get() {
              trace.queryGets += 1;
              const docs = [...entities.entries()].slice(0, count).map(([id, data]) =>
                docSnapshot(true, { ...(data as object), id }),
              );
              trace.queryDocumentsRead += docs.length;
              return { docs };
            },
          };
        },
        where() {
          throw new Error('entity fallback does not use where queries');
        },
      };
    },
  };
}
