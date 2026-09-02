import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildEntityMediaRow, buildPrimaryImageForRelease } from './entity-media-row.ts';
import type { PinPlanRow } from './pin-commons-primary-images-plan.ts';

const BASE_PLAN_ROW: PinPlanRow = {
  entityId: 'ent_rosa_parks',
  url: 'https://commons.wikimedia.org/wiki/Special:FilePath/File:Rosa_Parks.jpg?width=960',
  fileTitle: 'File:Rosa Parks.jpg',
  sha1: 'deadbeef',
  license: 'CC BY-SA 4.0',
  credit: 'Wikimedia Commons',
  sourcePageUrl: 'https://commons.wikimedia.org/wiki/File:Rosa_Parks.jpg',
  alt: 'Rosa Parks, seated, 1955.',
};

test('buildPrimaryImageForRelease builds the full pin fields from a plan row', () => {
  const image = buildPrimaryImageForRelease(BASE_PLAN_ROW, 'licensed', '2026-09-02T00:00:00.000Z');
  assert.deepEqual(image, {
    url: BASE_PLAN_ROW.url,
    alt: BASE_PLAN_ROW.alt,
    credit: BASE_PLAN_ROW.credit,
    rightsStatus: 'licensed',
    sourceSystem: 'wikimedia_commons',
    fileTitle: BASE_PLAN_ROW.fileTitle,
    sha1: BASE_PLAN_ROW.sha1,
    sourcePageUrl: BASE_PLAN_ROW.sourcePageUrl,
    license: BASE_PLAN_ROW.license,
    pinnedAt: '2026-09-02T00:00:00.000Z',
  });
});

test('buildPrimaryImageForRelease omits sha1/license when the plan row lacks them', () => {
  const { sha1: _sha1, license: _license, ...rowWithoutOptionals } = BASE_PLAN_ROW;
  const image = buildPrimaryImageForRelease(
    rowWithoutOptionals,
    'public_domain',
    '2026-09-02T00:00:00.000Z',
  );
  assert.equal('sha1' in image, false);
  assert.equal('license' in image, false);
  assert.equal(image.rightsStatus, 'public_domain');
});

test('buildPrimaryImageForRelease is pure: same inputs, same output, no clock read', () => {
  const a = buildPrimaryImageForRelease(BASE_PLAN_ROW, 'licensed', '2026-09-02T00:00:00.000Z');
  const b = buildPrimaryImageForRelease(BASE_PLAN_ROW, 'licensed', '2026-09-02T00:00:00.000Z');
  assert.deepEqual(a, b);
});

test('buildEntityMediaRow maps a primaryImage into the entity_media column shape', () => {
  const image = buildPrimaryImageForRelease(BASE_PLAN_ROW, 'licensed', '2026-09-02T00:00:00.000Z');
  const row = buildEntityMediaRow('ent_rosa_parks', image);
  assert.deepEqual(row, {
    entityId: 'ent_rosa_parks',
    role: 'primary',
    sourceSystem: 'wikimedia_commons',
    fileTitle: BASE_PLAN_ROW.fileTitle,
    sha1: BASE_PLAN_ROW.sha1,
    sourcePageUrl: BASE_PLAN_ROW.sourcePageUrl,
    license: BASE_PLAN_ROW.license,
    credit: BASE_PLAN_ROW.credit,
    alt: BASE_PLAN_ROW.alt,
    url: BASE_PLAN_ROW.url,
    pinnedAt: '2026-09-02T00:00:00.000Z',
  });
});

test('buildEntityMediaRow nulls out sha1/license rather than omitting them (NOT NULL-free columns, explicit null)', () => {
  const image = buildPrimaryImageForRelease(
    { ...BASE_PLAN_ROW, sha1: undefined, license: undefined },
    'public_domain',
    '2026-09-02T00:00:00.000Z',
  );
  const row = buildEntityMediaRow('ent_rosa_parks', image);
  assert.equal(row.sha1, null);
  assert.equal(row.license, null);
});
