import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Button } from '../../src/design/components/Button';
import { focus, TOUCH_TARGET } from '../../src/design/tokens';
import { render } from '../../src/design/testing';

test('Button defaults to a native button, primary plate and caption type', () => {
  const view = render(<Button>Explore records</Button>);
  assert.equal(view.tags('button').length, 1);
  assert.equal(view.attr('button', 'type'), 'button');
  assert.equal(view.attr('button', 'disabled'), null);
  assert.equal(view.text(), 'Explore records');
  assert.match(view.raw, /var\(--accentGraphic\)/);
  assert.match(view.raw, /var\(--fixedInk\)/);
  assert.match(view.raw, /font-weight:600/);
});

test('Button preserves native attributes, types, custom classes and nested children', () => {
  for (const type of ['submit', 'reset', 'button'] as const) {
    const view = render(
      <Button
        type={type}
        id="save"
        name="action"
        value="save"
        aria-label="Save record"
        className="custom"
      >
        <span>Save</span>
      </Button>,
    );
    assert.equal(view.attr('button', 'type'), type);
    assert.equal(view.attr('button', 'id'), 'save');
    assert.equal(view.attr('button', 'name'), 'action');
    assert.equal(view.attr('button', 'value'), 'save');
    assert.equal(view.attr('button', 'aria-label'), 'Save record');
    assert.match(view.attr('button', 'class') ?? '', /custom/);
    assert.equal(view.text(), 'Save');
  }
});

test('Button forwards onPress to the Tamagui frame', () => {
  let presses = 0;
  const onPress = () => {
    presses += 1;
  };
  const element = Button({ children: 'Save', onPress });
  assert.ok(element && typeof element === 'object' && 'props' in element);
  const props = element.props as { onPress: () => void };
  assert.equal(props.onPress, onPress);
  props.onPress();
  assert.equal(presses, 1);
});

test('Button disabled is a real native disabled attribute, with disabled styles', () => {
  for (const variant of ['primary', 'secondary'] as const) {
    const view = render(
      <Button variant={variant} disabled>
        Unavailable
      </Button>,
    );
    assert.notEqual(view.attr('button', 'disabled'), null);
    assert.equal(view.attr('button', 'aria-disabled'), 'true');
    assert.match(view.raw, /opacity:0\.55/);
    assert.match(view.raw, /cursor:not-allowed/);
  }
});

test('Button variants and compact sizes use theme roles, touch targets and keyboard focus in both themes', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const variant of ['primary', 'secondary'] as const) {
      for (const compact of [false, true]) {
        const view = render(
          <Button variant={variant} compact={compact}>
            Find
          </Button>,
          theme,
        );
        for (const role of variant === 'primary'
          ? ['accentGraphic', 'fixedInk', 'focusRing']
          : ['borderStrong', 'ink', 'surfaceRaised', 'focusRing']) {
          assert.ok(view.raw.includes(`var(--${role})`), `${theme} ${variant} ${role}`);
        }
        assert.match(view.raw, /min-height:var\(--c-size-touch\)/);
        assert.match(view.raw, new RegExp(`--c-size-touch:\\s*${TOUCH_TARGET}px`));
        assert.match(view.raw, /focus-visible/);
        assert.match(view.raw, new RegExp(`outline-width:${focus.width}px`));
        assert.match(view.raw, new RegExp(`outline-offset:${focus.offset}px`));
        assert.match(view.raw, new RegExp(`padding-left:var\\(--c-space-${compact ? 4 : 5}\\)`));
        assert.doesNotMatch(view.html, /#[0-9a-f]{3,8}\b|rgba?\(/i);
      }
    }
  }
});

test('Button retains long and empty content without inventing a label', () => {
  const title = 'Search the historical records '.repeat(30).trim();
  assert.equal(render(<Button>{title}</Button>).text(), title);
  assert.equal(render(<Button>{''}</Button>).text(), '');
});

test('primary hover never fades the text (opacity on the whole button breaks 4.5:1)', () => {
  const view = render(<Button>Save</Button>);
  assert.doesNotMatch(view.raw, /opacity:0\.88/);
  assert.match(view.raw, /hover/i, 'there is still a hover treatment');
});
