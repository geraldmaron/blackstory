import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EmptyState } from '../../src/design/components/EmptyState';
import { Button } from '../../src/design/components/Button';
import { render } from '../../src/design/testing';

test('EmptyState is a status with an h2 title, body and optional action in order', () => {
  const view = render(
    <EmptyState title="No records" className="custom" action={<Button>Reset filters</Button>}>
      <p>Try another place.</p>
    </EmptyState>,
  );
  assert.equal(view.attr('div', 'role'), 'status');
  assert.equal(view.tags('h2').length, 1);
  assert.equal(view.text(), 'No records Try another place. Reset filters');
  assert.equal(view.tags('button').length, 1);
  assert.match(view.attr('div', 'class') ?? '', /custom/);
});

test('EmptyState supports absent optional props, null children and long text', () => {
  const title = 'No matching records '.repeat(30).trim();
  const body = 'Change the filters and search again. '.repeat(40).trim();
  const view = render(<EmptyState title={title}>{body}</EmptyState>);
  assert.equal(view.text(), `${title} ${body}`);
  assert.equal(view.tags('button').length, 0);
  assert.equal(render(<EmptyState title="No records">{null}</EmptyState>).text(), 'No records');
});

test('EmptyState uses theme roles and a dashed border in light and dark', () => {
  for (const theme of ['light', 'dark'] as const) {
    const view = render(<EmptyState title="No records">Try another search.</EmptyState>, theme);
    for (const role of ['surface', 'borderStrong', 'ink', 'inkMuted']) {
      assert.ok(view.raw.includes(`var(--${role})`), `${theme} ${role}`);
    }
    assert.match(view.raw, /border-top-style:dashed/);
    assert.doesNotMatch(view.html, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  }
});

test('the body measure is a reading width, not a 4px space token', () => {
  const view = render(<EmptyState title="None">Nothing matches those filters.</EmptyState>);
  assert.match(view.raw, /max-width:576px/);
  assert.doesNotMatch(view.raw, /max-width:var\(--c-space-48\)/);
});
