/**
 * Document theme resolution + bootstrap script contract tests.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resolvePreferredTheme,
  THEME_BOOTSTRAP_SCRIPT,
  THEME_STORAGE_KEY,
} from './document-theme.js';

describe('resolvePreferredTheme', () => {
  it('prefers stored light or dark over system', () => {
    assert.equal(resolvePreferredTheme('dark', false), 'dark');
    assert.equal(resolvePreferredTheme('light', true), 'light');
  });

  it('falls back to prefers-color-scheme when storage is empty', () => {
    assert.equal(resolvePreferredTheme(null, true), 'dark');
    assert.equal(resolvePreferredTheme(undefined, false), 'light');
    assert.equal(resolvePreferredTheme('garbage', true), 'dark');
  });
});

describe('THEME_BOOTSTRAP_SCRIPT', () => {
  it('embeds the storage key and sets data-theme', () => {
    assert.match(THEME_BOOTSTRAP_SCRIPT, new RegExp(THEME_STORAGE_KEY));
    assert.match(THEME_BOOTSTRAP_SCRIPT, /setAttribute\('data-theme'/);
    assert.match(THEME_BOOTSTRAP_SCRIPT, /prefers-color-scheme:\s*dark/);
  });
});

describe('bootstrap script', () => {
  it('embeds the real storage key', () => {
    // The key is inlined rather than interpolated (see document-theme.ts). This is the guard that
    // keeps the literal and the constant from drifting apart, which would silently break theme
    // persistence: the bootstrap would read one key and the app would write another.
    assert.ok(
      THEME_BOOTSTRAP_SCRIPT.includes(`'${THEME_STORAGE_KEY}'`),
      `bootstrap must read ${THEME_STORAGE_KEY}`,
    );
  });
});
