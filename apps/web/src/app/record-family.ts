/**
 * What every record family shares: which family owns a kind, and the reader's way back into the
 * list or map they arrived from (map and list hrefs, list prev/next).
 *
 * Shared so each family derives its return paths from the same arrival rather than two copies
 * that drift.
 */
import {
  placeArrivalQuery,
  placeDiscoveryReturn,
  recordsQueryFromDiscovery,
  type DiscoveryState,
  type PlaceDiscoveryReturn,
} from '../lib/discovery/discovery-state';
import { findRecordsNeighbors } from '../lib/records/build-records-index';
import { resolveStoryCollectionSource } from '../lib/stories/source';
import {
  collectionMemberIds,
  resolveStoryCollection,
  storyCollectionSlug,
} from '../lib/discovery/story-collection';
import { loadRecordsCatalog } from '../lib/records/records-catalog';

/** The public families a released record can address. */
export type RecordFamily = 'place' | 'invention';

/** The family that owns a record of this kind. */
export function familyForKind(kind: string | undefined): RecordFamily {
  return kind === 'invention' ? 'invention' : 'place';
}

type ListNeighbors = Parameters<typeof placeDiscoveryReturn>[3];

/**
 * Previous/next within the list the reader came from, for any record family. Only a list origin
 * has an order to step through; a map or direct arrival yields nothing. Reads the one released
 * bibliography (`loadRecordsCatalog`), already cached per request.
 */
async function loadRecordListNeighbors(
  arrival: DiscoveryState,
  entityId: string,
): Promise<ListNeighbors> {
  if (arrival.view !== 'list') return undefined;
  const { data: catalog } = await loadRecordsCatalog();
  const query = recordsQueryFromDiscovery(arrival);
  // A named collection steps through its own released members. When it cannot be resolved
  // (unknown story, failed read, malformed token) there is no list to step through; the arrival
  // never falls back to stepping through the whole archive.
  let members: ReadonlySet<string> | undefined;
  if (query.collection !== '') {
    const slug = storyCollectionSlug(query.collection);
    if (slug === undefined) return undefined;
    members = collectionMemberIds(
      resolveStoryCollection(
        await resolveStoryCollectionSource(slug),
        new Set((catalog as readonly { readonly id: string }[]).map((entry) => entry.id)),
      ),
    );
    if (members === undefined) return undefined;
  }
  const found = findRecordsNeighbors(
    catalog,
    query,
    entityId,
    placeArrivalQuery(arrival, 'list'),
    members,
  );
  if (!found) return undefined;
  return {
    ...(found.previous
      ? { previous: { href: found.previous.href, name: found.previous.name } }
      : {}),
    ...(found.next ? { next: { href: found.next.href, name: found.next.name } } : {}),
    index: found.index,
    total: found.total,
  };
}

/** Shared return builder so every family derives its map/list paths from the same arrival. */
export async function recordDiscoveryReturn(
  entityId: string,
  arrival: DiscoveryState,
  geo: { readonly lat: number; readonly lng: number } | undefined,
  mapped = true,
): Promise<PlaceDiscoveryReturn> {
  const neighbors = await loadRecordListNeighbors(arrival, entityId);
  return placeDiscoveryReturn(entityId, arrival, geo, neighbors, mapped);
}
