import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadFixture } from '../testing/load-fixture.js';
import { contentPageV1Schema } from './content.js';

test('round-trips a valid content page (real story fixture, mirroring apps/web/src/data/stories-seed.ts)', () => {
  const fixture = loadFixture<Record<string, unknown>>('content-page.v1.current.json');
  assert.deepEqual(contentPageV1Schema.parse(fixture), fixture);
});

test('rejects a section with an empty paragraph (adversarial: hidden empty content)', () => {
  const fixture = loadFixture<Record<string, unknown>>('content-page.v1.current.json');
  assert.throws(() => contentPageV1Schema.parse({ ...fixture, body: [{ paragraphs: [''] }] }));
});

test('rejects an oversized body (adversarial: maliciously large DTO)', () => {
  const fixture = loadFixture<Record<string, unknown>>('content-page.v1.current.json');
  const bigSection = { paragraphs: ['x'.repeat(9000)] };
  assert.throws(() => contentPageV1Schema.parse({ ...fixture, body: Array.from({ length: 201 }, () => bigSection) }));
});
