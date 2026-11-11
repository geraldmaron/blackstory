import assert from 'node:assert/strict';
import { test } from 'node:test';
// Committed fixture stories: the round-trip must hold for every real prose string.
import { presidentStories } from '../../ops-data/fixtures/stories/presidents.ts';
import {
  findUnsafeStoryLinkHrefs,
  isSafeStoryLinkHref,
  parseStoryInline,
  serializeStoryInline,
  storyInlinePlainText,
  type StoryInlineNode,
} from './story-inline.ts';

const t = (text: string): StoryInlineNode => ({ type: 'text', text });

test('plain text, citation and entity atoms', () => {
  assert.deepEqual(parseStoryInline('a [ref:x-1] b [[ent_1]] c [[ent_2|Ida B. Wells]]'), [
    t('a '),
    { type: 'cite', refId: 'x-1' },
    t(' b '),
    { type: 'entity', entityId: 'ent_1', label: '' },
    t(' c '),
    { type: 'entity', entityId: 'ent_2', label: 'Ida B. Wells' },
  ]);
});

test('entity atom is opaque: marks inside its label are not scanned', () => {
  assert.deepEqual(parseStoryInline('[[id|A *B*]]'), [
    { type: 'entity', entityId: 'id', label: 'A *B*' },
  ]);
  assert.deepEqual(parseStoryInline('**a [[id|b**]] c**'), [
    {
      type: 'strong',
      children: [t('a '), { type: 'entity', entityId: 'id', label: 'b**' }, t(' c')],
    },
  ]);
});

test('newline is a break', () => {
  assert.deepEqual(parseStoryInline('a\nb'), [t('a'), { type: 'break' }, t('b')]);
});

test('strong, em, nesting and wrapping atoms', () => {
  assert.deepEqual(parseStoryInline('**bold** and _soft_'), [
    { type: 'strong', children: [t('bold')] },
    t(' and '),
    { type: 'em', children: [t('soft')] },
  ]);
  assert.deepEqual(parseStoryInline('**_x_**'), [
    { type: 'strong', children: [{ type: 'em', children: [t('x')] }] },
  ]);
  assert.equal(serializeStoryInline(parseStoryInline('_**x**_')), '**_x_**');
  assert.deepEqual(parseStoryInline('**[[ent_x|Ida B. Wells]]**'), [
    { type: 'strong', children: [{ type: 'entity', entityId: 'ent_x', label: 'Ida B. Wells' }] },
  ]);
  assert.deepEqual(parseStoryInline('_[ref:a]_'), [
    { type: 'em', children: [{ type: 'cite', refId: 'a' }] },
  ]);
});

test('flanking: delimiters next to whitespace are literal', () => {
  assert.deepEqual(parseStoryInline('2 ** 3 ** 4'), [t('2 ** 3 ** 4')]);
  assert.deepEqual(parseStoryInline('** a**'), [t('** a**')]);
});

test('snake_case stays literal, intraword underscore never opens or closes', () => {
  assert.deepEqual(parseStoryInline('use snake_case_name here'), [t('use snake_case_name here')]);
  assert.deepEqual(parseStoryInline('ent_1 and ent_2'), [t('ent_1 and ent_2')]);
});

test('unclosed marks are literal', () => {
  assert.deepEqual(parseStoryInline('**open'), [t('**open')]);
  assert.deepEqual(parseStoryInline('a _b'), [t('a _b')]);
  assert.deepEqual(parseStoryInline('**a _b** c_'), [
    { type: 'strong', children: [t('a _b')] },
    t(' c_'),
  ]);
});

test('external links: https only, safe href, label may carry marks', () => {
  assert.deepEqual(parseStoryInline('see [the **act**](https://example.org/a?b=1) now'), [
    t('see '),
    {
      type: 'link',
      href: 'https://example.org/a?b=1',
      children: [t('the '), { type: 'strong', children: [t('act')] }],
    },
    t(' now'),
  ]);
  assert.deepEqual(parseStoryInline('[x](http://example.org)'), [t('[x](http://example.org)')]);
  assert.deepEqual(parseStoryInline('[x](javascript:alert(1))'), [t('[x](javascript:alert(1))')]);
  assert.deepEqual(parseStoryInline('[x](https://user:pw@example.org)'), [
    t('[x](https://user:pw@example.org)'),
  ]);
  assert.deepEqual(parseStoryInline('[ref:a](https://x.org)'), [
    { type: 'cite', refId: 'a' },
    t('(https://x.org)'),
  ]);
  assert.deepEqual(findUnsafeStoryLinkHrefs('[a](http://x.org) [b](https://ok.org)'), [
    'http://x.org',
  ]);
  assert.equal(isSafeStoryLinkHref('https://example.org/x'), true);
  assert.equal(isSafeStoryLinkHref('http://example.org'), false);
  assert.equal(isSafeStoryLinkHref('https://a@example.org'), false);
});

test('escapes', () => {
  assert.deepEqual(parseStoryInline('\\*a\\* \\_b\\_ \\\\ \\n'), [t('*a* _b_ \\ \\n')]);
  // Text that cannot be misread is stored exactly as typed.
  assert.equal(serializeStoryInline([t('a*b_c\\d')]), 'a*b_c\\d');
  // Escapes appear only when the plain form would read back as markup.
  for (const text of [
    '**not bold**',
    '_not em_',
    'see [ref:a] literally',
    '[[ent_x|not a link]]',
    '[x](https://x.org)',
  ]) {
    const stored = serializeStoryInline([t(text)]);
    assert.deepEqual(parseStoryInline(stored), [t(text)], `${text} -> ${stored}`);
  }
});

test('a link label keeps brackets and markup characters through a round trip', () => {
  const tree = [{ type: 'link' as const, href: 'https://x.org', children: [t('A]B [sic] 5*3')] }];
  const stored = serializeStoryInline(tree);
  assert.deepEqual(parseStoryInline(stored), tree, stored);
});

test('plain text keeps labels, drops citations and marks', () => {
  assert.equal(
    storyInlinePlainText('**Ida** [[e|Ida B. Wells]][ref:a] [x](https://x.org) [[e2]]'),
    'Ida Ida B. Wells  x e2',
  );
});

test('old-style strings round-trip byte for byte', () => {
  for (const s of [
    'plain.[ref:a][ref:b] Next [[e|L]] text\nline',
    'It is 5 * 3? no.',
    'snake_case and a\\b and [sic]',
    '',
  ]) {
    assert.equal(serializeStoryInline(parseStoryInline(s)), s);
  }
});

function proseStrings(): string[] {
  const out: string[] = [];
  for (const story of presidentStories as readonly { body: readonly Record<string, unknown>[] }[]) {
    for (const block of story.body) {
      if (typeof block.text === 'string') out.push(block.text);
      if (Array.isArray(block.items)) out.push(...(block.items as string[]));
    }
  }
  return out;
}

test('every fixture prose string round-trips unchanged', () => {
  const strings = proseStrings();
  assert.ok(strings.length > 100);
  for (const s of strings) assert.equal(serializeStoryInline(parseStoryInline(s)), s);
});

test('fuzz: parse never throws and serialize is a fixed point', () => {
  const pieces = [
    '*',
    '**',
    '_',
    '__',
    '\\',
    '[',
    ']',
    '(',
    ')',
    '\n',
    ' ',
    'a',
    'b1',
    'é',
    '|',
    '[ref:a]',
    '[[e]]',
    '[[e|L]]',
    '[x](https://a.org/p)',
    'https://',
    '[[',
    ']]',
    '](',
    '***',
  ];
  let seed = 12345;
  const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let n = 0; n < 3000; n += 1) {
    let s = '';
    const len = 1 + Math.floor(rand() * 12);
    for (let k = 0; k < len; k += 1) s += pieces[Math.floor(rand() * pieces.length)];
    const once = serializeStoryInline(parseStoryInline(s));
    const twice = serializeStoryInline(parseStoryInline(once));
    assert.equal(twice, once, `unstable for ${JSON.stringify(s)}`);
    assert.deepEqual(parseStoryInline(once), parseStoryInline(twice));
  }
});
