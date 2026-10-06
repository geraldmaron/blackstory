/**
 * Record and story mastheads: the photograph has its own centred band and the type reads below
 * it, at every width. Wide screens used to write the type over the photo and push a photo shown
 * whole to the right edge (`object-position: 88% center`), which left it off-centre beside an
 * empty dark field with the lede running across it.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const recordCss = read('./record-room.css');
const articleCss = read('../../../components/article/article.css');
const placeCss = read('../../home-first-paint.css');
const commandBarCss = read('../../../components/shell/command-bar.css');

test('no masthead pushes a photo off-centre to make room for type', () => {
  assert.doesNotMatch(recordCss + articleCss, /object-position:\s*88%/);
});

test('a record photo sits in its own band, clipped, with the type below on the canvas', () => {
  assert.match(
    recordCss,
    /\.ds-record-mast\[data-media='photo'\] > \*:first-child \{[^}]*position:\s*relative;[^}]*height:\s*clamp\([^}]*overflow:\s*hidden/s,
  );
  assert.match(
    recordCss,
    /\.ds-record-mast\[data-media='photo'\] \.ds-record-mast__over \{[^}]*background:\s*none/s,
  );
  // The band rules are not confined to phones any more.
  const firstMedia = recordCss.indexOf('@media (max-width: 47.9375rem), (max-height: 34.9375rem)');
  assert.ok(
    recordCss.indexOf(".ds-record-mast[data-media='photo'] {\n  display: block;") < firstMedia,
  );
  assert.match(
    placeCss,
    /\.ds-home-first-paint \.ds-record-mast\[data-media='photo'\] \{\s*min-height:\s*0/,
  );
});

test('a story hero sits in its own band with the headline below, no scrim or text shadow', () => {
  assert.match(
    articleCss,
    /\.ds-article-mast__photo \{[^}]*position:\s*relative;[^}]*height:\s*clamp/s,
  );
  assert.doesNotMatch(
    articleCss,
    /\.ds-article-mast\[data-media='photo'\] \.ds-article-mast__title[^{]*\{[^}]*text-shadow/s,
  );
});

test('the phone header shows the symbol alone at every width below 820px', () => {
  assert.match(
    commandBarCss,
    /:root \.ds-bar__brand \.ds-shell-wordmark__img\.ds-shell-wordmark__img--lockup \{\s*display:\s*none/,
  );
});
