import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ResultList, type ResultListLinkProps } from '../../src/design/components/ResultList';
import { render } from '../../src/design/testing';

const items = [
  {
    id: 'school',
    href: '/records/school',
    title: 'School',
    summary: 'A school in its community.',
    meta: <span>1865 · institution precision</span>,
  },
  { id: 'library', href: '/records/library', title: 'Library', summary: 'A public reading room.' },
];
test('result list emits labeled unordered list items with native links, titles, summaries and optional meta', () => {
  const view = render(<ResultList items={items} labelledBy="results" className="custom-results" />);
  assert.equal(view.attr('ul', 'aria-labelledby'), 'results');
  assert.match(view.attr('ul', 'class')!, /custom-results/);
  for (const tag of ['li', 'a', 'h3', 'p']) assert.equal(view.tags(tag).length, 2);
  assert.equal(view.attr('a', 'href'), '/records/school');
  assert.match(view.html, /<li\b[^>]*><a\b[^>]*>[\s\S]*<h3\b/);
  assert.match(
    view.text(),
    /School A school in its community. 1865 · institution precision Library A public reading room./,
  );
});
test('custom router links receive href, styling classes and all children', () => {
  function RouterLink({ href, className, children }: ResultListLinkProps) {
    return (
      <a href={href} className={className} data-router="test">
        {children}
      </a>
    );
  }
  const view = render(<ResultList items={items} LinkComponent={RouterLink} />);
  assert.equal(view.attr('a', 'data-router'), 'test');
  assert.ok(view.attr('a', 'class'));
  assert.equal(view.tags('h3').length, 2);
  assert.equal(view.attr('a', 'href'), '/records/school');
  assert.match(view.raw, /min-height:var\(--c-size-touch\)/);
  assert.match(view.raw, /focus-visible/);
});
test('empty lists and long text retain source defaults without truncation', () => {
  const empty = render(<ResultList items={[]} />);
  assert.equal(empty.tags('ul').length, 1);
  assert.equal(empty.tags('li').length, 0);
  assert.equal(empty.attr('ul', 'aria-labelledby'), null);
  const long = 'An extended record title '.repeat(100).trim();
  assert.equal(
    render(
      <ResultList items={[{ id: 'long', href: '/long', title: long, summary: long }]} />,
    ).text(),
    `${long} ${long}`,
  );
});
test('list borders, text, hover and keyboard focus use theme roles in both themes', () => {
  for (const theme of ['light', 'dark'] as const) {
    const view = render(<ResultList items={items} />, theme);
    for (const role of ['border', 'ink', 'inkMuted', 'inkSubtle', 'surface', 'focusRing'])
      assert.ok(view.raw.includes(`var(--${role})`), role);
    assert.doesNotMatch(view.html, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  }
});
