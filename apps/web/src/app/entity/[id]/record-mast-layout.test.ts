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

test('the photograph leads as an exhibit and the map follows it; neither is a ground or a plate', () => {
  const page = read('./EntityRecordPage.tsx');
  const pattern = read('../../../components/patterns/RecordPage.tsx');
  // Photograph, else the map: one lead, and a second map exhibit only when a photograph leads.
  assert.match(page, /const lead = photograph \?\? mapExhibit;/);
  assert.match(page, /photograph && mapExhibit \? \{ map: mapExhibit \}/);
  assert.match(page, /<ExhibitFrame\s+id=\{`\$\{entity\.id\}-map`\}\s+kind="map"\s+ground="ink"/);
  // A quiet record gets the quiet exhibit and a still map (DESIGN.md section 7.3, P-04).
  assert.match(page, /variant=\{quiet \? 'quiet' : 'full'\}/);
  assert.match(page, /still=\{quiet\}/);
  // The retired looks are gone with their last caller.
  for (const source of [page, pattern, recordCss]) {
    assert.doesNotMatch(
      source,
      /RecordGround|plateMap|data-grounded|ds-recpage__(plate|wash|mast)/,
    );
    assert.doesNotMatch(source, /\bplate\b/);
  }
  assert.doesNotMatch(recordCss, /ds-recpage\[data-ground\]|counter\(beat|ds-plate/);
});

test('the side column stands beside the reading on a desktop and dissolves into one column below it', () => {
  const pattern = read('../../../components/patterns/RecordPage.tsx');
  // Facts, actions, then the exhibits, all inside the side column, before the body.
  assert.match(
    pattern,
    /<div className="ds-recpage__side">[\s\S]*ds-recpage__facts[\s\S]*ds-recpage__actions[\s\S]*ds-recpage__lead[\s\S]*ds-recpage__map[\s\S]*<\/div>\s*<div className="ds-recpage__body">/,
  );
  const desktop = recordCss.slice(recordCss.indexOf('@media (min-width: 64rem)'));
  assert.match(desktop, /\.ds-recpage__main \{[^}]*display: grid;[^}]*'body side';/s);
  assert.match(desktop, /'head side'\s*'lede side'\s*'note side'/);
  // Phone order (DESIGN.md section 9.1): exhibit, name, summary, facts, first beat, map, the rest.
  const phone = recordCss.slice(
    recordCss.indexOf('@media (max-width: 63.99rem)'),
    recordCss.indexOf('@media (max-width: 47.9375rem)'),
  );
  const order = (selector: string) =>
    Number(new RegExp(`${selector} \\{[^}]*order: (\\d+)`, 's').exec(phone)?.[1]);
  const sequence = [
    order('\\.ds-recpage__lead'),
    order('\\.ds-recpage__head'),
    order('\\.ds-recpage__lede'),
    order('\\.ds-recpage__facts'),
    order('\\.ds-recpage__beat:first-child'),
    order('\\.ds-recpage__extra'),
    order('\\.ds-recpage__beat'),
    order('\\.ds-recpage__file'),
  ];
  assert.deepEqual(
    sequence,
    [...sequence].sort((a, b) => a - b),
  );
  assert.ok(sequence.every(Number.isFinite), String(sequence));
  // The facts are a ruled list on the page's paper, not a card on its own ground (DESIGN.md 7.4).
  assert.doesNotMatch(pattern, /ds-recpage__facts"[^>]*data-ground/);
});
