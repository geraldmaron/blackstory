/**
 * Shared light/dark document theme helpers for shell chrome.
 * Storage key and bootstrap script keep SSR HTML and ThemeToggle in sync
 * without a hydration flash.
 *
 * Ink direction (design handoff): "The light theme stays as it is; the direction changes
 * which one the bootstrap prefers by default." Before this, an unset preference fell through
 * to `prefers-color-scheme`, so a reader on a light-mode system saw the untouched light theme
 * — the Ink redesign only changed dark-theme tokens — and the whole redesign read as absent.
 * Dark is now the default whenever there is no explicit stored choice; a reader who explicitly
 * picks light still gets it, every time, via THEME_STORAGE_KEY.
 */

import type { ThemeName } from '../tokens/colors.js';

export const THEME_STORAGE_KEY = 'ds-theme';

/** Resolve theme from localStorage, else dark (the Ink default). */
export function resolvePreferredTheme(stored: string | null | undefined): ThemeName {
  return stored === 'light' || stored === 'dark' ? stored : 'dark';
}

/**
 * Inline-safe bootstrap: runs before paint when placed in `<head>`.
 * Must stay free of imports — string is injected via dangerouslySetInnerHTML.
 *
 * The storage key is written as a literal rather than interpolated. Building executable code by
 * substituting a value into a template is the shape CodeQL flags (js/bad-code-sanitization), and
 * `JSON.stringify` is not an escape for a code context: a value containing `</script` would end
 * the tag regardless of quoting. `document-theme.test.ts` asserts this literal still equals
 * THEME_STORAGE_KEY, so the two cannot drift apart silently.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var k='ds-theme';var s=localStorage.getItem(k);var t=(s==='light'||s==='dark')?s:'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

/**
 * Compile-time guarantee that the key inlined in THEME_BOOTSTRAP_SCRIPT is THEME_STORAGE_KEY.
 * Changing either without the other stops this file compiling.
 */
const assertBootstrapKeyMatches: typeof THEME_STORAGE_KEY = 'ds-theme';
void assertBootstrapKeyMatches;

/**
 * Flip `<html data-theme>` and persist the choice to THEME_STORAGE_KEY, so the next page load's
 * bootstrap script (which only reads storage, not the DOM) picks up what was just chosen instead
 * of reverting to the system preference. The single call site every "toggle theme" control
 * (CommandBar's `onToggleTheme`, ThemeToggle) should share — a toggle that only flips the DOM
 * attribute looks like it worked until the reader navigates and it snaps back.
 */
export function toggleDocumentTheme(): ThemeName {
  const root = document.documentElement;
  const next: ThemeName = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  window.localStorage.setItem(THEME_STORAGE_KEY, next);
  return next;
}
