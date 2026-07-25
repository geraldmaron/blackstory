/**
 * Entity sources for the embedding backfill CLI when `canonicalEntities` is empty or incomplete.
 *
 * Live prod currently publishes searchable text into `publicSearchIndex` (and release
 * projections) before canonical promotion fills `canonicalEntities`. These adapters map
 * search-index docs and national-catalog fixture JSON into `EntityEmbeddingInput` for the
 * shared `runBackfill` loop. Era pre-filters may be omitted: search/fixture records carry
 * `eraBuckets` labels but not the kind-specific year fields `deriveEraBucket` reads.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { US_STATES } from '@repo/domain';
import type { Firestore } from 'firebase-admin/firestore';
import type { EntityKindDoc } from '../firestore/types.js';
import type { CanonicalEntitySource, CanonicalEntitySourcePage } from './backfill-cli.js';
import type { EntityEmbeddingInput } from './pipeline.js';

const PAGE_SIZE = 200;

const STATE_BY_NAME = new Map(
  US_STATES.map((state) => [state.name.toLowerCase(), state.postalCode]),
);
const STATE_BY_POSTAL = new Map(US_STATES.map((state) => [state.postalCode, state.postalCode]));

const ENTITY_KINDS = new Set<string>([
  'person',
  'place',
  'school',
  'organization',
  'institution',
  'event',
  'law',
  'case',
  'publication',
  'artifact',
  'movement',
  'other',
]);

export type SearchIndexEmbeddingRecord = {
  readonly id?: string;
  readonly kind?: string;
  readonly displayName?: string;
  readonly summary?: string;
  readonly aliases?: readonly string[];
  readonly jurisdictionState?: string;
  readonly eraBuckets?: readonly string[];
};

export type CatalogFixtureEmbeddingRecord = {
  readonly id?: string;
  readonly kind?: string;
  readonly displayName?: string;
  readonly summary?: string;
  readonly aliases?: readonly string[];
  readonly jurisdictionLabel?: string;
  readonly locationLabel?: string;
  readonly eraBuckets?: readonly string[];
};

/** Resolves a 2-letter US state/DC code from a jurisdiction label like "City, Pennsylvania". */
export function parseStateCodeFromJurisdiction(label: string | undefined): string | undefined {
  if (!label || !label.trim()) return undefined;
  const tail = label.split(',').pop()?.trim() ?? '';
  if (!tail) return undefined;
  if (/^d\.?c\.?$/i.test(tail) || /district of columbia/i.test(tail)) {
    return 'DC';
  }
  if (/^[A-Za-z]{2}$/.test(tail)) {
    return STATE_BY_POSTAL.get(tail.toUpperCase());
  }
  return STATE_BY_NAME.get(tail.toLowerCase());
}

function asEntityKind(kind: string | undefined): EntityKindDoc {
  if (kind && ENTITY_KINDS.has(kind)) return kind as EntityKindDoc;
  return 'other';
}

/**
 * Maps a publicSearchIndex-shaped record into an embedding input.
 * `docId` is the Firestore document id (preferred entity id).
 */
export function mapSearchIndexRecordToEmbeddingInput(
  docId: string,
  data: SearchIndexEmbeddingRecord,
): EntityEmbeddingInput | undefined {
  const displayName =
    typeof data.displayName === 'string' && data.displayName.trim()
      ? data.displayName.trim()
      : undefined;
  if (!displayName) return undefined;

  const entityId = typeof data.id === 'string' && data.id.trim() ? data.id.trim() : docId.trim();
  if (!entityId) return undefined;

  const aliases = Array.isArray(data.aliases)
    ? data.aliases.filter(
        (alias): alias is string => typeof alias === 'string' && alias.trim().length > 0,
      )
    : undefined;
  const summary =
    typeof data.summary === 'string' && data.summary.trim() ? data.summary.trim() : undefined;
  const state = parseStateCodeFromJurisdiction(
    typeof data.jurisdictionState === 'string' ? data.jurisdictionState : undefined,
  );
  const placeLabel =
    typeof data.jurisdictionState === 'string' && data.jurisdictionState.trim()
      ? data.jurisdictionState.trim()
      : undefined;

  return {
    entityId,
    entity: {
      kind: asEntityKind(data.kind),
      displayName,
      ...(summary !== undefined ? { summary } : {}),
      ...(aliases !== undefined && aliases.length > 0
        ? { aliases: aliases.map((value) => ({ value })) }
        : {}),
    },
    ...(state !== undefined || placeLabel !== undefined
      ? {
          location: {
            ...(state !== undefined ? { state } : {}),
            ...(placeLabel !== undefined ? { placeLabel } : {}),
          },
        }
      : {}),
  };
}

/** Maps a national-catalog fixture entry into an embedding input. */
export function mapCatalogFixtureRecordToEmbeddingInput(
  data: CatalogFixtureEmbeddingRecord,
): EntityEmbeddingInput | undefined {
  const entityId = typeof data.id === 'string' && data.id.trim() ? data.id.trim() : undefined;
  const displayName =
    typeof data.displayName === 'string' && data.displayName.trim()
      ? data.displayName.trim()
      : undefined;
  if (!entityId || !displayName) return undefined;

  const aliases = Array.isArray(data.aliases)
    ? data.aliases.filter(
        (alias): alias is string => typeof alias === 'string' && alias.trim().length > 0,
      )
    : undefined;
  const summary =
    typeof data.summary === 'string' && data.summary.trim() ? data.summary.trim() : undefined;
  const state = parseStateCodeFromJurisdiction(
    typeof data.jurisdictionLabel === 'string' ? data.jurisdictionLabel : undefined,
  );
  const placeLabel =
    typeof data.locationLabel === 'string' && data.locationLabel.trim()
      ? data.locationLabel.trim()
      : typeof data.jurisdictionLabel === 'string' && data.jurisdictionLabel.trim()
        ? data.jurisdictionLabel.trim()
        : undefined;

  return {
    entityId,
    entity: {
      kind: asEntityKind(data.kind),
      displayName,
      ...(summary !== undefined ? { summary } : {}),
      ...(aliases !== undefined && aliases.length > 0
        ? { aliases: aliases.map((value) => ({ value })) }
        : {}),
    },
    ...(state !== undefined || placeLabel !== undefined
      ? {
          location: {
            ...(state !== undefined ? { state } : {}),
            ...(placeLabel !== undefined ? { placeLabel } : {}),
          },
        }
      : {}),
  };
}

function pageItems(
  items: readonly EntityEmbeddingInput[],
  cursor: string | undefined,
  pageSize: number,
): CanonicalEntitySourcePage {
  const startIndex = cursor ? items.findIndex((item) => item.entityId === cursor) + 1 : 0;
  const page = items.slice(startIndex, startIndex + pageSize);
  const last = page.at(-1);
  return {
    items: page,
    ...(last && startIndex + pageSize < items.length ? { nextCursor: last.entityId } : {}),
  };
}

/**
 * Pages `publicSearchIndex` ordered by document id. Skips docs missing displayName.
 */
export function createFirestorePublicSearchIndexEntitySource(
  firestore: Firestore,
  pageSize = PAGE_SIZE,
): CanonicalEntitySource {
  return {
    async listPage(cursor) {
      let query = firestore.collection('publicSearchIndex').orderBy('__name__').limit(pageSize);
      if (cursor) {
        query = query.startAfter(cursor);
      }
      const snapshot = await query.get();
      const items: EntityEmbeddingInput[] = [];
      for (const doc of snapshot.docs) {
        const mapped = mapSearchIndexRecordToEmbeddingInput(
          doc.id,
          doc.data() as SearchIndexEmbeddingRecord,
        );
        if (mapped) items.push(mapped);
      }
      const lastDoc = snapshot.docs.at(-1);
      return {
        items,
        ...(lastDoc && snapshot.docs.length === pageSize ? { nextCursor: lastDoc.id } : {}),
      };
    },
  };
}

/**
 * Loads all `*.json` arrays from a national-catalog fixtures directory into a paged source.
 */
export function createNationalCatalogFixtureEntitySource(
  fixturesDir: string,
  pageSize = PAGE_SIZE,
): CanonicalEntitySource {
  const files = readdirSync(fixturesDir)
    .filter((name) => name.endsWith('.json'))
    .sort();
  const items: EntityEmbeddingInput[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    const parsed = JSON.parse(readFileSync(join(fixturesDir, file), 'utf8')) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error(`Fixture ${file} is not a JSON array`);
    }
    for (const entry of parsed) {
      const mapped = mapCatalogFixtureRecordToEmbeddingInput(
        entry as CatalogFixtureEmbeddingRecord,
      );
      if (!mapped) continue;
      if (seen.has(mapped.entityId)) continue;
      seen.add(mapped.entityId);
      items.push(mapped);
    }
  }

  return {
    async listPage(cursor) {
      return pageItems(items, cursor, pageSize);
    },
  };
}
