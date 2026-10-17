import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Card } from '../../src/design/components/Card';
import { render } from '../../src/design/testing';

test('Card defaults to an article, with optional h3 title and meta before the body', () => {
  const view = render(
    <Card title="Archive" meta={<span>1920</span>}>
      Record body
    </Card>,
  );
  assert.equal(view.tags('article').length, 1);
  assert.equal(view.tags('h3').length, 1);
  assert.equal(view.text(), 'Archive 1920 Record body');
});

test('Card maps every as value to real elements and preserves native attributes', () => {
  for (const as of ['article', 'section', 'div'] as const) {
    const view = render(
      <Card
        as={as}
        id="archive"
        aria-label="Archive records"
        className="custom"
        data-source="catalog"
      >
        Body
      </Card>,
    );
    assert.equal(view.tags(as).length, 1);
    assert.equal(view.attr(as, 'id'), 'archive');
    assert.equal(view.attr(as, 'aria-label'), 'Archive records');
    assert.equal(view.attr(as, 'data-source'), 'catalog');
    assert.match(view.attr(as, 'class') ?? '', /custom/);
  }
});

test('Card supports missing and empty title/meta and long content', () => {
  const text = 'Historical context '.repeat(40).trim();
  for (const props of [{}, { title: '', meta: null }]) {
    const view = render(<Card {...props}>{text}</Card>);
    assert.equal(view.tags('h3').length, 0);
    assert.equal(view.text(), text);
  }
});

test('Card interactive hover and focus-within are opt-in without changing semantics', () => {
  const passive = render(<Card>Body</Card>);
  const active = render(
    <Card interactive>
      <a href="#record">Read record</a>
    </Card>,
  );
  assert.doesNotMatch(passive.attr('article', 'class') ?? '', /hover|focusWithin/);
  assert.match(active.raw, /hover/);
  assert.match(active.raw, /focus-within/);
  assert.match(active.raw, /var\(--borderStrong\)/);
  assert.equal(active.attr('article', 'role'), null);
  assert.equal(active.attr('a', 'href'), '#record');
});

test('Card colors are theme roles in both themes, without literal markup colors', () => {
  for (const theme of ['light', 'dark'] as const) {
    const view = render(
      <Card title="Record" meta="Date" interactive>
        Body
      </Card>,
      theme,
    );
    for (const role of ['surfaceRaised', 'border', 'borderStrong', 'ink', 'inkSubtle']) {
      assert.ok(view.raw.includes(`var(--${role})`), `${theme} ${role}`);
    }
    assert.doesNotMatch(view.html, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  }
});
