/**
 * Validates WCAG contrast for critical light/dark text and UI token pairs.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  contrastRatio,
  criticalTextPairs,
  criticalUiPairs,
  meetsContrast,
  themes,
} from './index.ts';

for (const theme of themes) {
  test(`${theme} critical text pairs meet WCAG AA (4.5:1)`, () => {
    for (const [name, fg, bg] of criticalTextPairs(theme)) {
      const ratio = contrastRatio(fg, bg);
      assert.ok(
        meetsContrast(fg, bg, 'AA'),
        `${theme} ${name}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1 (need 4.5:1)`,
      );
    }
  });

  test(`${theme} UI / focus pairs meet 3:1`, () => {
    for (const [name, fg, bg] of criticalUiPairs(theme)) {
      const ratio = contrastRatio(fg, bg);
      assert.ok(ratio >= 3, `${theme} ${name}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1 (need 3:1)`);
    }
  });
}

test('primary ink on canvas aims for AAA where practical', () => {
  for (const theme of themes) {
    const [[, fg, bg]] = criticalTextPairs(theme);
    assert.ok(fg && bg);
    assert.ok(
      meetsContrast(fg, bg, 'AAA'),
      `${theme} ink/canvas should meet AAA; got ${contrastRatio(fg, bg).toFixed(2)}:1`,
    );
  }
});
