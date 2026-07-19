/**
 * Validates WCAG contrast for critical light/dark text and UI token pairs.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  contrastRatio,
  criticalTextPairs,
  criticalUiPairs,
  dataViz,
  meetsContrast,
  themePalettes,
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

test('data-viz emphasis color meets 3:1 against both canvases', () => {
  for (const theme of themes) {
    const canvas = themePalettes[theme].canvas;
    const ratio = contrastRatio(dataViz.emphasis, canvas);
    assert.ok(ratio >= 3, `${theme} dataViz.emphasis/canvas is ${ratio.toFixed(2)}:1 (need 3:1)`);
  }
});

/**
 * Brand guide p.7 accessible-pairs table (brand pack v3). Computed ratios:
 * ink/paper 17.28, copper-text/paper 5.55, copper-dark/ink 6.14, stone/paper 4.88.
 */
test('brand guide light-theme accessible pairs hold their published ratios', () => {
  const pairs: ReadonlyArray<readonly [string, string, string, number]> = [
    ['Black Ink on Archive Paper', '#0A0A0A', '#F4EFE5', 17],
    ['Copper text on Archive Paper', '#8E4F2A', '#F4EFE5', 5.4],
    ['Copper dark on Black Ink', '#D07A32', '#0A0A0A', 6.0],
    ['Stone on Archive Paper', '#6D675F', '#F4EFE5', 4.8],
  ];
  for (const [name, fg, bg, min] of pairs) {
    const ratio = contrastRatio(fg, bg);
    assert.ok(ratio >= min, `${name}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1 (need ${min}:1)`);
  }
});

/**
 * Dark theme (paper/ink inversion) pairs. Computed ratios: paper-ink/canvas
 * 17.28, dark Stone/canvas 9.75, copper-dark/Charcoal 5.61 all AA for text.
 */
test('brand guide dark-theme pairs meet WCAG AA for text', () => {
  const pairs: ReadonlyArray<readonly [string, string, string, number]> = [
    ['Paper ink on Black Ink canvas', '#F4EFE5', '#0A0A0A', 7],
    ['Dark Stone on Black Ink canvas', '#BDB5A9', '#0A0A0A', 4.5],
    ['Copper dark on Charcoal surface', '#D07A32', '#161616', 4.5],
  ];
  for (const [name, fg, bg, min] of pairs) {
    const ratio = contrastRatio(fg, bg);
    assert.ok(ratio >= min, `${name}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1 (need ${min}:1)`);
  }
});
