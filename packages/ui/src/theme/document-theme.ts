/**
 * Shared light/dark document theme helpers for shell chrome.
 * Storage key and bootstrap script keep SSR HTML and ThemeToggle in sync
 * without a hydration flash (prefers-color-scheme when unset).
 */

import type { ThemeName } from '../tokens/colors.js';

export const THEME_STORAGE_KEY = 'ds-theme';

/** Resolve theme from localStorage, then prefers-color-scheme, else light. */
export function resolvePreferredTheme(
  stored: string | null | undefined,
  prefersDark: boolean,
): ThemeName {
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return prefersDark ? 'dark' : 'light';
}

/**
 * Inline-safe bootstrap: runs before paint when placed in `<head>`.
 * Must stay free of imports — string is injected via dangerouslySetInnerHTML.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var s=localStorage.getItem(k);var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var t=(s==='light'||s==='dark')?s:(d?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;
