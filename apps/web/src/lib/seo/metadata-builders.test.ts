/**
 * metadata builder tests protected fields must never reach previews.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import robots from '../../app/robots';
import {
  buildEntityPageMetadata,
  buildPublicMetadataPreview,
  buildStaticPageMetadata,
} from './metadata-builders';
import { PROTECTED_METADATA_KEYS, stripProtectedFields } from './protected-fields';

test('stripProtectedFields removes confidence scores and coordinates', () => {
  const stripped = stripProtectedFields({
    displayName: 'Safe title',
    confidenceScore: 0.92,
    mapPin: { x: 12, y: 34 },
    summary: 'Public-safe summary',
  });
  assert.equal(stripped.displayName, 'Safe title');
  assert.equal(stripped.confidenceScore, undefined);
  assert.equal(stripped.mapPin, undefined);
});

test('buildEntityPageMetadata omits residential addresses and dispute notes from description', () => {
  const metadata = buildEntityPageMetadata({
    id: 'ent_test',
    displayName: 'Sample school',
    summary: '123 Main Street, Springfield — internal only',
    disputeNote: 'moderation note',
    confidenceScore: 0.88,
    sensitivity: { class: 'contextual', basisClaimIds: ['clm_hidden'] },
  });
  assert.equal(typeof metadata.description, 'string');
  assert.doesNotMatch(metadata.description as string, /123 Main Street/i);
  assert.doesNotMatch(metadata.description as string, /moderation/i);
  assert.doesNotMatch(metadata.description as string, /0\.88/);
});

test('buildPublicMetadataPreview sets canonical and openGraph without protected keys', () => {
  const preview = buildPublicMetadataPreview({
    title: 'Search',
    description: 'Keyword search over published records.',
    canonicalPath: '/search',
  });
  assert.equal(preview.title, 'Search');
  assert.equal(preview.openGraph?.url?.endsWith('/search'), true);
  for (const key of PROTECTED_METADATA_KEYS) {
    const serialized = JSON.stringify(preview);
    assert.doesNotMatch(serialized, new RegExp(`"${key}"`));
  }
});

test('buildStaticPageMetadata honors noIndex for non-public surfaces', () => {
  const metadata = buildStaticPageMetadata({
    path: '/admin',
    title: 'Admin',
    description: 'Restricted',
    noIndex: true,
  });
  // `follow` stays true (SP-19). Dropping a page from the index is not a reason to also throw
  // away where it points; the two instructions were conflated here before.
  assert.deepEqual(metadata.robots, { index: false, follow: true });
});

test('a route marked noIndex in the registry cannot ship an indexable head', () => {
  // /design-system passes no `noIndex` of its own — the registry is what decides, so the flag
  // cannot be lost by editing the page and forgetting to repeat it.
  const metadata = buildStaticPageMetadata({
    path: '/design-system',
    title: 'Design system',
    description: 'Component and token fixtures.',
  });
  assert.deepEqual(metadata.robots, { index: false, follow: true });
});

test('every static room emits an absolute self-canonical', () => {
  // A relative canonical is only resolved by Next when `metadataBase` is set, and it is not; it
  // would emit verbatim and tell a crawler nothing. Sixteen rooms shipped with no canonical at
  // all before SP-19, so every filter and tracking permutation of them was a separate URL.
  for (const path of ['/about', '/books', '/stories', '/law', '/memorial', '/rooms']) {
    const metadata = buildStaticPageMetadata({ path, title: 'Room', description: 'A room.' });
    const canonical = metadata.alternates?.canonical;
    assert.equal(typeof canonical, 'string');
    assert.match(String(canonical), /^https?:\/\/.+/);
    assert.ok(String(canonical).endsWith(path), `${path} does not self-canonicalise`);
  }
});

test('every static room routes its head through the builder', () => {
  // The builder is what makes a canonical absolute and reads the registry's noindex. A room that
  // exports a bare `metadata` object skips both silently — that is how sixteen rooms came to ship
  // without canonicals — so the adoption is asserted rather than left to review.
  //
  // Excluded: Explore and /records build `alternates` directly (one must carry no title, the
  // other's canonical carries a narrowing), and /history and /search are redirect routes whose
  // metadata never reaches a reader.
  const appDir = join(import.meta.dirname, '../../app');
  const exempt = new Set(['history', 'search', 'records']);

  const walk = (dir: string): void => {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      if (item.isDirectory()) {
        // Dynamic segments are skipped: a `[slug]` route builds its canonical per record in
        // `generateMetadata`, and `/corrections/status/[receiptCode]` wants no canonical at all —
        // it carries an `X-Robots-Tag: noindex` from next.config.mjs instead, because a receipt
        // code is one person's private handle rather than a page worth listing.
        if (item.name.startsWith('_') || item.name.startsWith('[')) continue;
        if (!exempt.has(item.name)) walk(join(dir, item.name));
        continue;
      }
      if (item.name !== 'page.tsx') continue;
      // Explore (`app/page.tsx`) builds `alternates` directly — it must carry no `title`, which
      // `buildStaticPageMetadata` always sets — so it is excluded the same way `/records` is.
      if (dir === appDir) continue;
      const source = readFileSync(join(dir, item.name), 'utf8');
      if (!/^export const metadata/m.test(source)) continue; // generateMetadata builds its own
      assert.match(
        source,
        /buildStaticPageMetadata\(/,
        `${join(dir, item.name)} exports metadata without the builder, so it has no canonical`,
      );
    }
  };

  walk(appDir);
});

test('robots.txt adds no Disallow for the routes that carry a noindex', () => {
  // Disallow and noindex are opposite instructions: a Disallowed URL is never fetched, so its
  // noindex is never read and the URL can still be indexed from an inbound link alone. SP-19
  // ships the noindex ALONE for exactly this reason, and this is the standing guard.
  const rules = [robots().rules].flat();
  const disallowed = rules.flatMap((rule) => [rule?.disallow ?? []].flat());
  assert.deepEqual([...new Set(disallowed)], ['/'], 'only the AI-training agents are disallowed');

  const wildcard = rules.find((rule) => rule?.userAgent === '*');
  assert.equal(wildcard?.disallow, undefined, 'the general crawler must not be blocked anywhere');
  assert.equal(wildcard?.allow, '/');
});

test('a room description survives the protected-pattern filter', () => {
  // `sanitizePreviewText` silently swaps in a generic fallback when a string trips a protected
  // pattern — /moderation/i and the address shapes are easy to trip in prose about corrections.
  // A room whose description is silently replaced ships a wrong social preview and nothing warns.
  const description =
    'Challenge or correct a published BlackStory record through moderated review.';
  const metadata = buildStaticPageMetadata({
    path: '/corrections',
    title: 'Corrections',
    description,
  });
  assert.equal(metadata.description, description);
});
