import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Notice } from '../../src/design/components/Notice';
import { VisuallyHidden } from '../../src/design/components/VisuallyHidden';
import { render } from '../../src/design/testing';

test('Notice tones have the source role, decorative cue and hidden spoken prefix', () => {
  for (const [tone, cue] of [
    ['warning', 'Warning'],
    ['dispute', 'Disputed'],
    ['error', 'Error'],
  ] as const) {
    const view = render(
      <Notice tone={tone} title="Check this source" className="custom">
        <p>Evidence details</p>
      </Notice>,
    );
    assert.equal(view.attr('div', 'role'), tone === 'error' ? 'alert' : 'status');
    assert.equal(view.attr('span', 'aria-hidden'), 'true');
    assert.match(view.attr('div', 'class') ?? '', /custom/);
    assert.equal(view.text(), `${cue} ${cue}: Check this source Evidence details`);
    assert.equal(view.tags('p').length, 2);
    assert.match(view.raw, /opacity:0(?:;|})/);
    assert.match(view.raw, /position:absolute/);
  }
});

test('Notice uses tone foreground, background and border roles in each theme', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const tone of ['warning', 'dispute', 'error'] as const) {
      const view = render(
        <Notice tone={tone} title="Review">
          Details
        </Notice>,
        theme,
      );
      for (const suffix of ['Fg', 'Bg', 'Border']) {
        assert.ok(view.raw.includes(`var(--${tone}${suffix})`), `${theme} ${tone}${suffix}`);
      }
      assert.doesNotMatch(view.html, /#[0-9a-f]{3,8}\b|rgba?\(/i);
    }
  }
});

test('Notice retains long titles and supports an empty body without optional class', () => {
  const title = 'A claim needs more evidence '.repeat(35).trim();
  const view = render(
    <Notice tone="warning" title={title}>
      {null}
    </Notice>,
  );
  assert.equal(view.text(), `Warning Warning: ${title}`);
  assert.equal(view.attr('div', 'role'), 'status');
});

test('VisuallyHidden is an accessible span with a noninteractive one-pixel overflow box', () => {
  const view = render(<VisuallyHidden>Warning: </VisuallyHidden>);
  assert.equal(view.text(), 'Warning:');
  assert.equal(view.attr('span', 'aria-hidden'), null);
  assert.doesNotMatch(view.html, /hidden="|aria-hidden="true"/);
  assert.match(view.raw, /overflow-x:hidden/);
  assert.match(view.raw, /overflow-y:hidden/);
  assert.match(view.raw, /width:1px/);
  assert.match(view.raw, /height:1px/);
  assert.match(view.raw, /pointer-events:none/);
});
