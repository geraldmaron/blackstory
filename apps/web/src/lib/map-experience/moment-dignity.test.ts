import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { isViolenceAdjacent } from './camera-dignity';
import { resolveMomentPlain, type MomentSubject } from './moment-dignity';

describe('moment dignity · resolveMomentPlain', () => {
  it('has no opinion with no subject and no override', () => {
    assert.equal(resolveMomentPlain(null), false);
    assert.equal(resolveMomentPlain(undefined), false);
  });

  it('derives true from a violence-adjacent tone', () => {
    assert.equal(resolveMomentPlain({ mapTone: 'massacre' }), true);
  });

  it('derives true from a violence-adjacent topic term the tone union does not carry', () => {
    assert.equal(resolveMomentPlain({ topicTags: ['Lynching'] }), true);
    assert.equal(resolveMomentPlain({ topicIds: ['racial-violence'] }), true);
  });

  it('derives false from a subject with no violence-adjacent signal', () => {
    assert.equal(resolveMomentPlain({ topicTags: ['neighborhood'] }), false);
  });

  it('an explicit override always wins, in both directions', () => {
    assert.equal(resolveMomentPlain({ mapTone: 'massacre' }, false), false);
    assert.equal(resolveMomentPlain(null, true), true);
    assert.equal(resolveMomentPlain(undefined, true), true);
  });
});

/* —— enumeration: every moment actually rendered in the app ——————————————————— */

/**
 * "A test enumerates every moment in the app, resolves its subject, and fails when a
 * violence-adjacent subject is not plain" (repo-92n2.33's acceptance criterion). `MapMoment`
 * itself already refuses to be dramatised — see `resolveMomentPlain` above — so a call site
 * cannot get this wrong by omission. What it can still get wrong is an explicit `plain={false}`
 * fighting a subject it was handed, which is the one way a future call site could reintroduce
 * the exact regression this bead exists to close. This walks the real source tree rather than a
 * fixture list, so a moment added after this package closes is covered without editing this file.
 */

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** Every `<MapMoment ...>` (self-closing) tag's raw source text, brace-depth aware so a nested
 *  `subject={{ ... }}` object cannot fool a naive search for the tag's closing `>`. Skips
 *  `<MapMomentStage`, a different component with the same prefix. */
function findMapMomentTags(source: string): string[] {
  const tags: string[] = [];
  let cursor = 0;
  for (;;) {
    const start = source.indexOf('<MapMoment', cursor);
    if (start === -1) break;
    const boundary = source[start + '<MapMoment'.length];
    if (boundary !== undefined && !/[\s/]/.test(boundary)) {
      cursor = start + 1;
      continue;
    }
    let depth = 0;
    let end = -1;
    for (let i = start; i < source.length; i += 1) {
      const ch = source[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      else if (depth === 0 && ch === '>') {
        end = i;
        break;
      }
    }
    if (end === -1) break;
    tags.push(source.slice(start, end + 1));
    cursor = end + 1;
  }
  return tags;
}

/** Every quoted string literal in `text`, in order, with its quotes stripped — single- or
 *  double-quoted, and not fooled by a delimiter of the other kind or a comma appearing inside
 *  one. Used instead of a naive `split(',')` / `[^'"]*` match, both of which mis-parse the moment
 *  a literal contains a comma or an embedded opposite-kind quote. */
function quotedStrings(text: string): string[] {
  const out: string[] = [];
  const re = /'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    out.push(match[1] !== undefined ? match[1] : (match[2] ?? ''));
  }
  return out;
}

/** Pulls the literal fields `MomentSubject` (== `RecordLike`) actually uses out of a statically
 *  written `subject={{ ... }}` object. Returns `null` when the call site has no `subject` prop,
 *  or its value is not a literal this can read (e.g. a variable) — nothing to check there. */
function extractSubject(tag: string): MomentSubject | null {
  const match = /subject=\{\{([\s\S]*?)\}\}/.exec(tag);
  if (!match) return null;
  const body = match[1] ?? '';

  const stringArray = (field: string): string[] | undefined => {
    const found = new RegExp(`${field}\\s*:\\s*\\[([^\\]]*)\\]`).exec(body);
    if (!found) return undefined;
    return quotedStrings(found[1] ?? '');
  };
  const stringField = (field: string): string | undefined => {
    const afterField = new RegExp(`${field}\\s*:\\s*`).exec(body);
    if (!afterField) return undefined;
    const rest = body.slice(afterField.index + afterField[0].length);
    const literal = /^'([^'\\]*(?:\\.[^'\\]*)*)'|^"([^"\\]*(?:\\.[^"\\]*)*)"/.exec(rest);
    if (!literal) return undefined;
    return literal[1] !== undefined ? literal[1] : literal[2];
  };

  return {
    topicTags: stringArray('topicTags'),
    topicIds: stringArray('topicIds'),
    mapTone: stringField('mapTone'),
    kind: stringField('kind'),
    displayName: stringField('displayName'),
  };
}

/** The literal `plain` an author wrote at the call site, if any: JSX shorthand (`plain`), or an
 *  explicit `plain={true}` / `plain={false}`. `undefined` means the call site left it to derive.
 *  Quoted strings (e.g. a `note="..."` that happens to mention the word "plain") are blanked out
 *  before the shorthand check runs, so prose cannot be misread as a prop. */
function extractPlainOverride(tag: string): boolean | undefined {
  const withoutSubject = tag.replace(/subject=\{\{[\s\S]*?\}\}/, '');
  if (/\bplain=\{false\}/.test(withoutSubject)) return false;
  if (/\bplain=\{true\}/.test(withoutSubject)) return true;
  const withoutStrings = withoutSubject.replace(
    /'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"/g,
    '',
  );
  if (/(?:\s|^)plain(?=[\s/>])/.test(withoutStrings)) return true;
  return undefined;
}

describe('moment dignity · the enumeration scan itself', () => {
  it('a quoted array entry containing a comma does not get mis-split into extra entries', () => {
    const subject = extractSubject(
      "<MapMoment subject={{ topicTags: ['Duluth, Minnesota lynching', 'Lynching'] }} camera={{center:[0,0]}} note=\"x\" />",
    );
    assert.deepEqual(subject?.topicTags, ['Duluth, Minnesota lynching', 'Lynching']);
  });

  it('a string field is not truncated by an embedded quote of the other kind', () => {
    const subject = extractSubject(
      `<MapMoment subject={{ displayName: 'The 1921 "Greenwood District" massacre' }} camera={{center:[0,0]}} note="x" />`,
    );
    assert.equal(subject?.displayName, 'The 1921 "Greenwood District" massacre');
  });

  it('the word "plain" inside an unrelated note string is not read as an override', () => {
    const override = extractPlainOverride(
      '<MapMoment camera={{center:[0,0]}} note="a note that mentions plain in passing" />',
    );
    assert.equal(override, undefined);
  });

  it('still finds a real bare plain shorthand once the note text is out of the way', () => {
    const override = extractPlainOverride(
      '<MapMoment camera={{center:[0,0]}} note="unrelated" plain />',
    );
    assert.equal(override, true);
  });

  it('a subject passed as a variable reference is skipped, not mis-parsed', () => {
    const subject = extractSubject(
      '<MapMoment subject={someImportedConstant} camera={{center:[0,0]}} note="x" />',
    );
    assert.equal(subject, null);
  });

  it('does not match MapMomentStage, a different component with the same prefix', () => {
    const tags = findMapMomentTags('<MapMomentStage>{children}</MapMomentStage>');
    assert.deepEqual(tags, []);
  });
});

describe('moment dignity · every moment in the app', () => {
  it('resolves its subject, and none override a violence-adjacent subject away from plain', () => {
    const files = walk(SRC_DIR).filter(
      (file) => file.endsWith('.tsx') && !file.endsWith('.test.tsx'),
    );

    const checked: string[] = [];
    let violentChecked = 0;
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const tag of findMapMomentTags(source)) {
        const subject = extractSubject(tag);
        if (!subject) continue; // no statically-readable subject; nothing this scan can resolve

        const relative = path.relative(SRC_DIR, file);
        checked.push(relative);

        const violent = isViolenceAdjacent(subject);
        if (violent) violentChecked += 1;
        const override = extractPlainOverride(tag);
        const resolved = resolveMomentPlain(subject, override);
        if (violent && !resolved) {
          offenders.push(
            `${relative}: subject ${JSON.stringify(subject)} is violence-adjacent but resolves to LIVE`,
          );
        }
      }
    }

    // Checking *some* literal subject is not enough: a floor on `checked.length` alone would stay
    // green forever if the one violence-adjacent fixture (RoomKitGallery's Duluth specimen) were
    // ever edited to a non-violent subject, and nothing would announce that this guard had gone
    // vacuous. Requiring at least one CHECKED subject to actually be violence-adjacent is what
    // keeps the `offenders` assertion below meaningful rather than trivially satisfied.
    assert.ok(
      checked.length > 0,
      'expected at least one MapMoment call site with a literal subject',
    );
    assert.ok(
      violentChecked > 0,
      'expected at least one checked subject to be violence-adjacent, or this guard cannot prove it still catches anything',
    );
    assert.deepEqual(offenders, []);
  });
});
