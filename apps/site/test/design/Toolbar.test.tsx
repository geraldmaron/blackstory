import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Toolbar, ToolbarField } from '../../src/design/components/Toolbar';
import { render } from '../../src/design/testing';

test('plain toolbar defaults, children, actions and custom classes', () => {
  const view = render(
    <Toolbar label="Record controls" className="custom-toolbar" actions={<button>Export</button>}>
      <span>Search controls</span>
    </Toolbar>,
  );
  assert.equal(view.attr('div', 'role'), 'toolbar');
  assert.equal(view.attr('div', 'aria-label'), 'Record controls');
  assert.equal(view.attr('div', 'aria-orientation'), 'horizontal');
  assert.match(view.attr('div', 'class')!, /custom-toolbar/);
  assert.equal(view.tags('form').length, 0);
  assert.equal(view.text(), 'Search controls Export');
  assert.equal(render(<Toolbar label="Empty" />).text(), '');
  assert.equal(render(<Toolbar label="Search" role="search" />).attr('div', 'role'), 'search');
});
test('GET and POST forms work without JavaScript and preserve exact native submission attributes', () => {
  for (const method of [undefined, 'get', 'post'] as const) {
    const view = render(
      <Toolbar
        label="Search records"
        action="/records"
        method={method}
        preservedParams={{ topic: 'schools & libraries', page: '2', empty: '' }}
        actions={<button type="submit">Search</button>}
      >
        <ToolbarField label="Query">
          <input type="search" name="q" defaultValue="history" />
        </ToolbarField>
      </Toolbar>,
    );
    assert.equal(view.tags('form').length, 1);
    assert.equal(view.attr('form', 'action'), '/records');
    assert.equal(view.attr('form', 'method'), method ?? 'get');
    assert.equal(view.attr('form', 'role'), 'search');
    assert.equal(view.attr('form', 'aria-label'), 'Search records');
    assert.equal(view.attr('form', 'aria-orientation'), null);
    const hidden = view.tags('input').filter((tag) => tag.includes('type="hidden"'));
    assert.equal(hidden.length, 3);
    assert.ok(
      hidden.some(
        (tag) => tag.includes('name="topic"') && tag.includes('value="schools &amp; libraries"'),
      ),
    );
    assert.ok(hidden.some((tag) => tag.includes('name="page"') && tag.includes('value="2"')));
    assert.ok(hidden.some((tag) => tag.includes('name="empty"') && tag.includes('value=""')));
    assert.ok(
      view.tags('input').some((tag) => tag.includes('name="q"') && tag.includes('value="history"')),
    );
    assert.equal(view.attr('button', 'type'), 'submit');
  }
});
test('explicit form role, no preserved params, empty action and non-form params', () => {
  const form = render(<Toolbar label="Actions" action="/actions" role="toolbar" />);
  assert.equal(form.attr('form', 'role'), 'toolbar');
  assert.equal(form.tags('input').length, 0);
  for (const action of [undefined, '']) {
    const plain = render(
      <Toolbar label="View" action={action} preservedParams={{ ignored: 'yes' }} />,
    );
    assert.equal(plain.tags('form').length, 0);
    assert.equal(plain.tags('input').length, 0);
  }
});
test('fields retain visible and visually hidden labels, controls and long text', () => {
  const long = 'An accessible search label '.repeat(30).trim();
  for (const labelHidden of [undefined, false, true]) {
    const view = render(
      <ToolbarField label={long} labelHidden={labelHidden} className="custom-field">
        <select name="sort">
          <option value="date">Date</option>
        </select>
      </ToolbarField>,
    );
    assert.equal(view.tags('label').length, 1);
    assert.match(view.attr('label', 'class')!, /custom-field/);
    assert.equal(view.attr('select', 'name'), 'sort');
    assert.equal(view.text(), `${long} Date`);
    assert.doesNotMatch(view.html, /aria-hidden|hidden="/);
    // VisuallyHidden: 1px box, overflow hidden, transparent. It stays in the accessibility tree.
    if (labelHidden) assert.match(view.raw, /width:1px/);
    assert.match(view.raw, /min-height:var\(--c-size-touch\)/);
    assert.match(view.raw, /focus-within/);
  }
});
test('field chrome, labels and focus use theme roles in both themes', () => {
  for (const theme of ['light', 'dark'] as const) {
    const view = render(
      <Toolbar label="Search">
        <ToolbarField label="Query">
          <input name="q" />
        </ToolbarField>
      </Toolbar>,
      theme,
    );
    for (const role of ['inkMuted', 'border', 'surfaceRaised', 'focusRing'])
      assert.ok(view.raw.includes(`var(--${role})`), role);
    assert.doesNotMatch(view.html, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  }
});
