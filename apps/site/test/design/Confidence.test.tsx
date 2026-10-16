import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Confidence } from '../../src/design/components/Confidence';
import { render } from '../../src/design/testing';

test('a badge is a status with the tier, a hidden glyph and the label as its text', () => {
  const view = render(<Confidence level="medium" />);
  assert.equal(view.attr('span', 'role'), 'status');
  assert.equal(view.attr('span', 'data-tier'), 'medium');
  assert.equal(view.text(), '●●○ Medium confidence');
  // Exactly one element is hidden from assistive tech and it is the glyph; the frame and the label are exposed.
  const hidden = view.html.match(/<span\b[^>]*aria-hidden="true"[^>]*>([^<]*)</g) ?? [];
  assert.equal(hidden.length, 1);
  assert.match(hidden[0]!, />●○?●?/);
  assert.doesNotMatch(
    view.tags('span').find((t) => t.includes('role="status"'))!,
    /aria-hidden/,
  );
  assert.doesNotMatch(view.html, /aria-hidden="true"[^>]*>Medium confidence/);
});

test('default labels, a custom label, and the three marks', () => {
  assert.match(render(<Confidence level="high" />).text(), /●●● High confidence/);
  assert.match(render(<Confidence level="low" />).text(), /●○○ Low confidence/);
  assert.match(
    render(<Confidence level="high" label="Confirmed by three sources" />).text(),
    /Confirmed by three sources/,
  );
});

test('colors are theme roles, in both themes, and no literal color reaches the markup', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const level of ['high', 'medium', 'low'] as const) {
      const Level = level[0]!.toUpperCase() + level.slice(1);
      const view = render(<Confidence level={level} />, theme);
      assert.ok(
        view.raw.includes(`var(--confidence${Level}Bg)`),
        `${theme} ${level} background role`,
      );
      assert.ok(
        view.raw.includes(`var(--confidence${Level}Border)`),
        `${theme} ${level} border role`,
      );
      assert.ok(view.raw.includes(`var(--confidence${Level}Fg)`), `${theme} ${level} text role`);
      assert.doesNotMatch(
        view.html,
        /#[0-9a-f]{3,8}\b|rgba?\(/i,
        'no literal color in the elements',
      );
    }
  }
});

test('the frame is a span (inline content) not a div, so it can sit inside a sentence or a table cell', () => {
  const view = render(<Confidence level="high" />);
  assert.equal(view.tags('div').length, 0);
  assert.equal(view.tags('span').length >= 1, true);
});
