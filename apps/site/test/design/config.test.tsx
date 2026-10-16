import assert from 'node:assert/strict';
import { test } from 'node:test';
import { config } from '../../src/design/config';
import { render, emitsCssValue } from '../../src/design/testing';
import { TOUCH_TARGET, themes } from '../../src/design/tokens';
import { YStack } from '@tamagui/stacks';
import { SizableText } from '@tamagui/text';

test('the config carries both themes with every role plus the Tamagui aliases', () => {
  for (const name of ['light', 'dark'] as const) {
    const theme = config.themes[name] as unknown as Record<string, { val: string }>;
    for (const role of Object.keys(themes[name])) assert.ok(role in theme, `${name}.${role}`);
    assert.equal(theme.background?.val, themes[name].canvas);
    assert.equal(theme.color?.val, themes[name].ink);
    assert.equal(theme.borderColor?.val, themes[name].border);
  }
});

test('the emitted CSS carries every shipped role value, and the provider marks the theme', () => {
  for (const name of ['light', 'dark'] as const) {
    for (const [role, value] of Object.entries(themes[name]))
      assert.ok(emitsCssValue(value), `${name}.${role} ${value}`);
  }
  assert.match(render(<YStack />, 'light').raw, /\bt_light\b/);
  assert.match(render(<YStack />, 'dark').raw, /\bt_dark\b/);
});

test('tokens: space, radius and the touch size', () => {
  const tokens = config.tokens as unknown as Record<string, Record<string, { val: number }>>;
  assert.equal(tokens.space?.['4']?.val, 16);
  assert.equal(tokens.radius?.md?.val, 14);
  assert.equal(tokens.size?.touch?.val, TOUCH_TARGET);
});

test('media queries follow the grid breakpoints', () => {
  const media = config.media as Record<string, Record<string, unknown>>;
  assert.equal(media.maxMd?.maxWidth, 767);
  assert.equal(media.gtMd?.minWidth, 768);
  assert.equal(media.gtXl?.minWidth, 1280);
});

test('fonts: four registers, no CSS variables left in a family string', () => {
  const fonts = config.fonts as unknown as Record<string, { family: string }>;
  assert.deepEqual(Object.keys(fonts).sort(), ['body', 'editorial', 'heading', 'mono']);
  for (const font of Object.values(fonts)) assert.doesNotMatch(font.family, /var\(/);
});

test('render helper: landmarks via render=, roles resolve per theme, hidden text is readable', () => {
  const view = render(
    <YStack render="section" aria-label="Example" backgroundColor="$surface">
      <SizableText color="$inkMuted">Hello</SizableText>
    </YStack>,
    'light',
  );
  assert.equal(view.tags('section').length, 1);
  assert.equal(view.attr('section', 'aria-label'), 'Example');
  assert.equal(view.text(), 'Hello');
  assert.match(view.raw, /_bg-surface/);
  assert.match(view.raw, /_col-inkMuted/);
  assert.doesNotMatch(view.html, /<style/);
});
