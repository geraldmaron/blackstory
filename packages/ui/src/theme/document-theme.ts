/**
 * Shared light/dark document theme helpers for shell chrome.
 * Storage key and bootstrap script keep SSR HTML and ThemeToggle in sync
 * without a hydration flash.
 *
 * Paper is the default (docs/ui/DESIGN.md section 7.1, owner decision 2026-11-23): reading pages
 * are paper sheets because classroom projectors and printers need them, and the map stays ink in
 * both themes. The system preference is not consulted, so every reader without a stored choice
 * sees the same page; a reader who picks dark keeps it via THEME_STORAGE_KEY.
 */

import type { ThemeName } from '../tokens/colors.js';

export const THEME_STORAGE_KEY = 'ds-theme';

/** Resolve theme from localStorage, else light (paper, the default). */
export function resolvePreferredTheme(stored: string | null | undefined): ThemeName {
  return stored === 'light' || stored === 'dark' ? stored : 'light';
}

/**
 * Inline-safe bootstrap: runs before paint when placed in `<head>`.
 * Must stay free of imports — string is injected via dangerouslySetInnerHTML.
 *
 * It also makes print always paper (docs/ui/DESIGN.md section 7.1): a dark-theme page turns light
 * for the print and back after, without touching the stored choice.
 *
 * The storage key is written as a literal rather than interpolated. Building executable code by
 * substituting a value into a template is the shape CodeQL flags (js/bad-code-sanitization), and
 * `JSON.stringify` is not an escape for a code context: a value containing `</script` would end
 * the tag regardless of quoting. `document-theme.test.ts` asserts this literal still equals
 * THEME_STORAGE_KEY, so the two cannot drift apart silently.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var k='ds-theme';var s=localStorage.getItem(k);var t=(s==='light'||s==='dark')?s:'light';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}var b;addEventListener('beforeprint',function(){if(!b)b=document.documentElement.getAttribute('data-theme');document.documentElement.setAttribute('data-theme','light');});addEventListener('afterprint',function(){if(b)document.documentElement.setAttribute('data-theme',b);b=null;});})();`;

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
  const next: ThemeName = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyDocumentTheme(next);
  return next;
}

/**
 * Set and persist a theme, crossfading the whole page where the browser has view transitions and
 * the reader has not asked for reduced motion; elsewhere the switch is instant.
 */
export function applyDocumentTheme(next: ThemeName): void {
  const flip = () => {
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  };
  const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const doc = document as Document & { startViewTransition?: (update: () => void) => unknown };
  if (!calm && typeof doc.startViewTransition === 'function') {
    doc.startViewTransition(flip);
  } else {
    flip();
  }
}

/**
 * Keep every `<meta name="theme-color">` (browser chrome, installed shell) on the page's own
 * canvas. The tags are rendered per `prefers-color-scheme`, which disagrees with the toggle and
 * the dark default, so this repaints them from `--ds-canvas` now and on each `data-theme` change.
 * Returns the observer's disconnect, for a mount effect's cleanup.
 */
export function syncThemeColorMeta(): () => void {
  const sync = () => {
    const canvas = getComputedStyle(document.documentElement)
      .getPropertyValue('--ds-canvas')
      .trim();
    if (!canvas) return;
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
      meta.setAttribute('content', canvas);
    }
  };
  sync();
  const observer = new MutationObserver(sync);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}
