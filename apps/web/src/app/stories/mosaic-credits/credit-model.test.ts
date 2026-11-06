import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listPublicEntities } from '../../../data/public-seed';
import { mosaicCreditRow, mosaicCreditsPage } from './credit-model';

const tile = {
  index: '001',
  entityId: 'published',
  path: '/tile.jpg',
  sourceUrl: 'https://media.example/old.jpg',
};

test('credit labels use published names and do not infer missing records', () => {
  const entity = {
    ...listPublicEntities()[0]!,
    displayName: 'Published name',
    primaryImage: {
      url: 'https://media.example/new.jpg',
      alt: '',
      credit: 'Current credit',
      rightsStatus: 'public_domain' as const,
    },
  };
  assert.equal(mosaicCreditRow(tile, entity).name, 'Published name');
  assert.equal(mosaicCreditRow(tile, undefined).name, undefined);
  assert.equal(
    mosaicCreditRow({ ...tile, sourceUrl: 'javascript:alert(1)' }, entity).recordedImageHref,
    undefined,
  );
});

test('mosaic pages clamp stale bookmarks and bound the current metadata read', () => {
  assert.deepEqual(mosaicCreditsPage('999', 232), { page: 10, pageCount: 10, start: 216 });
  assert.equal(mosaicCreditsPage('bad', 232).page, 1);
  assert.equal(mosaicCreditsPage(['2', '999'], 232).start, 24);
});
