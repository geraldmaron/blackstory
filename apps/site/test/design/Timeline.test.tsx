import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Timeline } from '../../src/design/components/Timeline';
import { render } from '../../src/design/testing';

const items = [
  {
    id: 'founded',
    time: '1865-04-01',
    title: 'School founded',
    body: <p>A documented opening.</p>,
  },
  { id: 'moved', time: '1870', title: 'School moved' },
];
test('timeline preserves ordered items, labels, dates, headings and optional rich bodies', () => {
  const view = render(<Timeline items={items} labelledBy="history" className="custom-timeline" />);
  assert.equal(view.attr('ol', 'aria-labelledby'), 'history');
  assert.match(view.attr('ol', 'class')!, /custom-timeline/);
  assert.equal(view.tags('li').length, 2);
  assert.equal(view.tags('h3').length, 2);
  assert.equal(view.tags('time').length, 2);
  assert.equal(view.attr('time', 'dateTime'), '1865-04-01');
  assert.equal(view.tags('span').filter((tag) => tag.includes('aria-hidden="true"')).length, 2);
  assert.equal(view.tags('p').length, 1);
  assert.match(view.text(), /1865-04-01 School founded A documented opening. 1870 School moved/);
});
test('timeline defaults, empty items and untruncated long content', () => {
  const empty = render(<Timeline items={[]} />);
  assert.equal(empty.tags('ol').length, 1);
  assert.equal(empty.tags('li').length, 0);
  assert.equal(empty.attr('ol', 'aria-labelledby'), null);
  const long = 'A long archival account '.repeat(100).trim();
  const view = render(<Timeline items={[{ id: 'long', time: '1900', title: long, body: long }]} />);
  assert.equal(view.text(), `1900 ${long} ${long}`);
});
test('timeline rule, markers and text use roles in both themes', () => {
  for (const theme of ['light', 'dark'] as const) {
    const view = render(<Timeline items={items} />, theme);
    for (const role of ['border', 'ink', 'canvas', 'inkSubtle', 'inkMuted'])
      assert.ok(view.raw.includes(`var(--${role})`), role);
    assert.doesNotMatch(view.html, /#[0-9a-f]{3,8}\b|rgba?\(/i);
    assert.match(view.raw, /border-left-width:2px/);
  }
});
