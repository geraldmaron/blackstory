/** One released bibliography for Records and every projection of the same collection. */
import { cache } from 'react';
import type { PublicEntityView } from '../../data/public-seed';
import type { PublicSearchIndexDoc } from '@repo/domain/search';
import { getPublicSearchIndex } from '../public-data/source';
import { getSharedPublicEntities } from '../map-experience/shared-map-data';
import { searchIndexReadyForRecords } from './build-records-index';

type Readers = {
  readonly search: () => Promise<readonly PublicSearchIndexDoc[]>;
  readonly entities: () => Promise<readonly PublicEntityView[]>;
};

export async function resolveRecordsCatalog(readers: Readers) {
  // The index is an optimization. A failed optional projection must not hide a valid release.
  const docs = await readers.search().catch(() => []);
  if (searchIndexReadyForRecords(docs)) {
    return { data: docs, catalogSource: 'search_index' as const };
  }
  return { data: await readers.entities(), catalogSource: 'entities' as const };
}

export const loadRecordsCatalog = cache(() =>
  resolveRecordsCatalog({
    search: async () => (await getPublicSearchIndex()).data,
    entities: async () => (await getSharedPublicEntities()).data,
  }),
);
