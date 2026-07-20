/**
 * Light/dark theme toggle that sets `data-theme` on the document element.
 * Initial value matches the head bootstrap script (storage → prefers-color-scheme).
 */

'use client';

import React, { useEffect, useState } from 'react';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;
import type { ThemeName } from '../tokens/colors.js';
import { resolvePreferredTheme, THEME_STORAGE_KEY } from '../theme/document-theme.js';
import { cx } from '../utils/cx.js';

function readPreferredTheme(): ThemeName {
  if (typeof window === 'undefined') {
    return 'light';
  }
  const fromDom = document.documentElement.dataset.theme;
  if (fromDom === 'light' || fromDom === 'dark') {
    return fromDom;
  }
  return resolvePreferredTheme(
    window.localStorage.getItem(THEME_STORAGE_KEY),
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
}

export type ThemeToggleProps = {
  readonly className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const [theme, setTheme] = useState<ThemeName>('light');

  useEffect(() => {
    const initial = readPreferredTheme();
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  function toggle() {
    const next: ThemeName = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  }

  const next = theme === 'light' ? 'dark' : 'light';

  return (
    <button
      type="button"
      className={cx('ds-theme-toggle', className)}
      onClick={toggle}
      aria-pressed={theme === 'dark'}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      {theme === 'light' ? (
        /* Moon — the action: switch to dark. */
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
          <path
            d="M16.5 12.2A7 7 0 0 1 7.8 3.5a7 7 0 1 0 8.7 8.7Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        /* Sun — the action: switch to light. */
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
          <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M10 1.5v2.2M10 16.3v2.2M18.5 10h-2.2M3.7 10H1.5M16 4l-1.6 1.6M5.6 14.4 4 16M16 16l-1.6-1.6M5.6 5.6 4 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
