
/**
 * Light/dark theme toggle that sets `data-theme` on the document element.
 */

'use client';

import React, {  useEffect, useState  } from 'react';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;
import type { ThemeName } from '../tokens/colors.js';
import { cx } from '../utils/cx.js';

const STORAGE_KEY = 'bb-theme';

function readPreferredTheme(): ThemeName {
  if (typeof window === 'undefined') {
    return 'light';
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <button
      type="button"
      className={cx('bb-theme-toggle', className)}
      onClick={toggle}
      aria-pressed={theme === 'dark'}
    >
      Theme: {theme === 'light' ? 'Light' : 'Dark'}
    </button>
  );
}
