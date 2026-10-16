import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Pagination, pageWindow } from '../../src/design/components/Pagination';
import { render } from '../../src/design/testing';

const hrefForPage = (page: number) => `/records?page=${page}`;
const props = { page: 1, pageCount: 20, pageSize: 50, total: 975, hrefForPage };

test('pageWindow preserves the source algorithm at start, middle and end', () => {
  const cases: readonly [number, number, readonly (number | 'gap')[]][] = [
    [1, 0, []],
    [0, 0, []],
    [1, 1, [1]],
    [1, 7, [1, 2, 3, 4, 5, 6, 7]],
    [4, 7, [1, 2, 3, 4, 5, 6, 7]],
    [7, 7, [1, 2, 3, 4, 5, 6, 7]],
    [1, 8, [1, 2, 'gap', 8]],
    [4, 8, [1, 'gap', 3, 4, 5, 'gap', 8]],
    [8, 8, [1, 'gap', 7, 8]],
    [1, 20, [1, 2, 'gap', 20]],
    [10, 20, [1, 'gap', 9, 10, 11, 'gap', 20]],
    [20, 20, [1, 'gap', 19, 20]],
  ];
  for (const [page, count, expected] of cases)
    assert.deepEqual(pageWindow(page, count), expected, `${page}/${count}`);
});

test('pagination has real navigation, lists, labeled page anchors and disabled ends', () => {
  for (const page of [1, 10, 20]) {
    const view = render(<Pagination {...props} page={page} className="custom-pagination" />);
    assert.equal(view.attr('nav', 'aria-label'), 'Pagination');
    assert.match(view.attr('nav', 'class')!, /custom-pagination/);
    assert.equal(view.tags('ul').length, 1);
    const prev = view.tags('a').find((anchor) => anchor.includes('rel="prev"'));
    const next = view.tags('a').find((anchor) => anchor.includes('rel="next"'));
    if (page === 1) {
      // The first page has no previous page: not a link, so no tab stop and Enter goes nowhere.
      assert.equal(prev, undefined, 'no prev anchor on page 1');
      assert.ok(
        view.tags('span').some((tag) => tag.includes('aria-disabled="true"')),
        'a disabled prev is still announced',
      );
      assert.equal(view.text().includes('← Prev'), true, 'and still visible');
    } else {
      assert.match(prev!, new RegExp(`href="/records\\?page=${page - 1}"`));
    }
    if (page === 20) {
      assert.equal(next, undefined, 'no next anchor on the last page');
      assert.ok(view.tags('span').some((tag) => tag.includes('aria-disabled="true"')));
    } else {
      assert.match(next!, new RegExp(`href="/records\\?page=${page + 1}"`));
    }
    assert.equal(
      view.tags('a').filter((anchor) => anchor.includes('aria-disabled')).length,
      0,
      'no anchor is ever disabled',
    );
    const current = view.tags('a').filter((anchor) => anchor.includes('aria-current="page"'));
    assert.equal(current.length, 1);
    assert.match(current[0]!, new RegExp(`aria-label="Page ${page}"`));
    assert.equal(
      view.tags('li').filter((item) => item.includes('aria-hidden="true"')).length,
      page === 10 ? 2 : 1,
    );
    assert.match(view.raw, /text-decoration-line:underline/);
    assert.match(view.raw, /min-height:var\(--c-size-touch\)/);
    assert.match(view.raw, /focus-visible/);
  }
});

test('ranges, empty and single page states and long item labels', () => {
  assert.match(render(<Pagination {...props} page={2} />).text(), /51–100 of 975 results/);
  assert.match(render(<Pagination {...props} page={20} />).text(), /951–975 of 975 results/);
  const empty = render(<Pagination {...props} pageCount={0} total={0} itemLabel="records" />);
  assert.equal(empty.text(), 'No records');
  assert.equal(empty.tags('a').length, 0);
  const label = 'historical records with independently reviewed sources '.repeat(10).trim();
  const single = render(<Pagination {...props} pageCount={1} total={1} itemLabel={label} />);
  assert.equal(single.tags('a').length, 0);
  assert.equal(single.text(), `1–1 of 1 ${label}`);
  assert.match(render(<Pagination {...props} total={3195} />).text(), /3,195/);
});

test('pagination uses theme roles and token focus in both themes', () => {
  for (const theme of ['light', 'dark'] as const) {
    const view = render(<Pagination {...props} />, theme);
    for (const role of ['ink', 'inkMuted', 'canvas', 'border', 'borderStrong', 'focusRing'])
      assert.ok(view.raw.includes(`var(--${role})`), role);
    assert.doesNotMatch(view.html, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  }
});
