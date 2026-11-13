/**
 * Record and story mastheads: a photograph is never cropped or pushed aside to make room for type. Wide screens used to write the type over the photo and push a photo shown
 * whole to the right edge (`object-position: 88% center`), which left it off-centre beside an
 * empty dark field with the lede running across it.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const recordCss = read('../../record-page.css');
const articleCss = read('../../../components/story/story.css');
const commandBarCss = read('../../../components/shell/command-bar.css');

test('no masthead pushes a photo off-centre to make room for type', () => {
  assert.doesNotMatch(recordCss + articleCss, /object-position:\s*88%/);
});

test('a record photo is shown whole in the rail, never cropped behind type', () => {
  assert.match(recordCss, /\.ds-recpage__photo-img \{[^}]*object-fit:\s*contain/s);
  assert.doesNotMatch(recordCss, /ds-record-mast/);
});

test('a story hero sits in its own band with the headline below, no scrim or text shadow', () => {
  assert.match(
    articleCss,
    /\.ds-reading-mast__photo \{[^}]*position:\s*relative;[^}]*height:\s*clamp/s,
  );
  assert.doesNotMatch(
    articleCss,
    /\.ds-reading-mast\[data-media='photo'\] \.ds-reading-mast__title[^{]*\{[^}]*text-shadow/s,
  );
});

test('the phone header shows the lockup artwork, sized down, never hidden', () => {
  const phone = commandBarCss.slice(commandBarCss.indexOf('@media (max-width: 47.9375rem)'));
  assert.match(phone, /\.ds-bar__brand \{\s*--ds-lockup-size:\s*3\.5rem/);
  assert.doesNotMatch(commandBarCss, /ds-shell-wordmark__img[^{]*\{\s*display:\s*none/);
});
