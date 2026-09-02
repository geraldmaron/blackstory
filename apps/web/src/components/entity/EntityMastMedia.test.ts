/**
 * SSR markup smoke tests for the entity mast photo chain (repo-4vuf, pin-and-serve).
 * Mirrors the render-to-static-markup pattern used by RecordGapNotice.test.ts.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { EntityMastMedia } from './EntityMastMedia.js';
import type { PublicEntityPrimaryImageView } from '../../data/public-seed.js';

const PINNED_IMAGE: PublicEntityPrimaryImageView = {
  url: 'https://commons.wikimedia.org/wiki/Special:FilePath/File:Rosa_Parks.jpg?width=960',
  alt: 'Rosa Parks, seated, 1955.',
  credit: 'Wikimedia Commons',
  rightsStatus: 'licensed',
  sourceSystem: 'wikimedia_commons',
  fileTitle: 'File:Rosa Parks.jpg',
  sha1: 'deadbeef',
  sourcePageUrl: 'https://commons.wikimedia.org/wiki/File:Rosa_Parks.jpg',
  license: 'CC-BY-SA-4.0',
  pinnedAt: '2026-09-02T00:00:00.000Z',
};

test('EntityMastMedia renders a pinned image with credit and a source link', () => {
  const html = renderToStaticMarkup(
    createElement(EntityMastMedia, {
      entityId: 'ent_rosa_parks',
      entityName: 'Rosa Parks',
      kind: 'person',
      primaryImage: PINNED_IMAGE,
    }),
  );
  assert.match(html, /<img[^>]*src="https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath/);
  assert.match(html, /Wikimedia Commons/);
  assert.match(html, /Source: Wikimedia Commons · CC-BY-SA-4\.0/);
  assert.match(
    html,
    /<a[^>]*href="https:\/\/commons\.wikimedia\.org\/wiki\/File:Rosa_Parks\.jpg"[^>]*>/,
  );
  assert.match(html, /rel="noopener noreferrer nofollow"/);
});

test('EntityMastMedia falls back to the EntityRecordMark when no primaryImage is present', () => {
  const html = renderToStaticMarkup(
    createElement(EntityMastMedia, {
      entityId: 'ent_no_photo',
      entityName: 'Freedmen School',
      kind: 'school',
    }),
  );
  assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /Source: Wikimedia Commons/);
  // Falls back to the kind-derived symbolic mark, never a broken <img>.
  assert.match(html, /svg|role="img"/i);
});

test('EntityMastMedia omits the source link for a legacy image with no pin fields', () => {
  const html = renderToStaticMarkup(
    createElement(EntityMastMedia, {
      entityId: 'ent_legacy',
      entityName: 'Legacy Entity',
      kind: 'place',
      primaryImage: {
        url: 'https://storage.googleapis.com/black-book-efaaf-public-media/public/entities/ent_legacy/primary.jpg',
        alt: 'A legacy stored photo.',
        credit: 'Public domain archival fixture',
        rightsStatus: 'public_domain',
      },
    }),
  );
  assert.match(html, /<img/);
  assert.doesNotMatch(html, /Source:/);
});
