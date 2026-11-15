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

test('a story hero is the whole picture under the headline: no blurred fill, scrim or text shadow', () => {
  assert.match(articleCss, /\.ds-story-mast > \.ds-story-mast__hero \{[^}]*grid-column:\s*wide/s);
  assert.doesNotMatch(articleCss, /ds-fit-photo__backdrop|text-shadow|backdrop-filter/);
});

test('the phone header shows the lockup artwork, sized down, never hidden', () => {
  const phone = commandBarCss.slice(commandBarCss.indexOf('@media (max-width: 47.9375rem)'));
  assert.match(phone, /\.ds-bar__brand \{\s*--ds-lockup-size:\s*3\.5rem/);
  assert.doesNotMatch(commandBarCss, /ds-shell-wordmark__img[^{]*\{\s*display:\s*none/);
});

test('a record photograph leads the masthead as a plate beside the name, never under it', () => {
  const page = read('./EntityRecordPage.tsx');
  // Only a record that is not quiet gets a plate; a quiet one keeps its photograph plain in the rail.
  assert.match(
    page,
    /!quiet && entity\.primaryImage && !isRenderedImage\(entity\.primaryImage\) \? \(\s*<RecordImage[\s\S]*?\n\s*plate\n/,
  );
  assert.match(page, /entity\.primaryImage && !plate \? \(\s*<RecordImage/);
  assert.match(page, /const quiet = isQuietRecord\(entity\)/);
  // The plate holds the right of the field and the head stops short of it: no type on the photo.
  assert.match(recordCss, /\.ds-recpage__plate \{[^}]*position:\s*absolute/s);
  assert.match(
    recordCss,
    /\.ds-recpage__mast\[data-plate\] \.ds-recpage__head \{[^}]*padding-right:/s,
  );
});

test('the sticky rail stops where the body ends, above the record file', () => {
  const pattern = read('../../../components/patterns/RecordPage.tsx');
  // The rail and the body share an inner box; the record file sits after it, outside.
  assert.match(
    pattern,
    /<div className="ds-recpage__main">[\s\S]*ds-recpage__rail[\s\S]*ds-recpage__body[\s\S]*<\/div>\s*<\/div>\s*<footer\s+className="ds-recpage__file"/,
  );
  const desktop = recordCss.slice(recordCss.indexOf('@media (min-width: 64rem)'));
  assert.match(desktop, /\.ds-recpage__grid \{\s*grid-template-areas:\s*'main'\s*'file';/);
  assert.match(desktop, /\.ds-recpage__main \{[^}]*display: grid;[^}]*'body  rail';/s);
  assert.doesNotMatch(desktop, /'file\s+file'/);
});
