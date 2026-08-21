/**
 * Document theme resolution + bootstrap script contract tests.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resolvePreferredTheme,
  THEME_BOOTSTRAP_SCRIPT,
  THEME_STORAGE_KEY,
  toggleDocumentTheme,
} from './document-theme.js';

/** Minimal document/window fakes — this package's test suite has no jsdom, and
 *  toggleDocumentTheme's only DOM surface is `documentElement.dataset` + `localStorage`. */
function withFakeDom<T>(initialTheme: string | undefined, run: () => T): T {
  const store = new Map<string, string>();
  const fakeDocument = {
    documentElement: { dataset: { theme: initialTheme } as Record<string, string | undefined> },
  };
  const fakeWindow = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    },
  };
  const globals = globalThis as unknown as { document: unknown; window: unknown };
  const previous = { document: globals.document, window: globals.window };
  globals.document = fakeDocument;
  globals.window = fakeWindow;
  try {
    return run();
  } finally {
    globals.document = previous.document;
    globals.window = previous.window;
  }
}

describe('resolvePreferredTheme', () => {
  it('respects an explicit stored choice, either way', () => {
    assert.equal(resolvePreferredTheme('dark'), 'dark');
    assert.equal(resolvePreferredTheme('light'), 'light');
  });

  it('falls back to dark — the Ink default — when storage has no explicit choice', () => {
    assert.equal(resolvePreferredTheme(null), 'dark');
    assert.equal(resolvePreferredTheme(undefined), 'dark');
    assert.equal(resolvePreferredTheme('garbage'), 'dark');
  });
});

describe('toggleDocumentTheme', () => {
  it('flips data-theme and persists the choice under THEME_STORAGE_KEY', () => {
    withFakeDom('light', () => {
      const next = toggleDocumentTheme();
      assert.equal(next, 'dark');
      assert.equal(document.documentElement.dataset.theme, 'dark');
      assert.equal(window.localStorage.getItem(THEME_STORAGE_KEY), 'dark');
    });
  });

  it('treats anything other than dark as light on the way in', () => {
    withFakeDom(undefined, () => {
      const next = toggleDocumentTheme();
      assert.equal(next, 'dark');
    });
    withFakeDom('dark', () => {
      const next = toggleDocumentTheme();
      assert.equal(next, 'light');
      assert.equal(window.localStorage.getItem(THEME_STORAGE_KEY), 'light');
    });
  });
});

describe('THEME_BOOTSTRAP_SCRIPT', () => {
  it('embeds the storage key and sets data-theme', () => {
    assert.match(THEME_BOOTSTRAP_SCRIPT, new RegExp(THEME_STORAGE_KEY));
    assert.match(THEME_BOOTSTRAP_SCRIPT, /setAttribute\('data-theme'/);
  });

  it('defaults to dark — not prefers-color-scheme — when storage has no explicit choice', () => {
    // Ink direction: the light theme is unchanged, so following system preference here would
    // show a first-time reader on a light-mode system the old design with no visible redesign.
    assert.doesNotMatch(THEME_BOOTSTRAP_SCRIPT, /prefers-color-scheme/);
    assert.match(THEME_BOOTSTRAP_SCRIPT, /:'dark'/);
    assert.match(THEME_BOOTSTRAP_SCRIPT, /setAttribute\('data-theme','dark'\)/);
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
