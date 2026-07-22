/**
 * Site identity constants for the GitHub Pages docs surface.
 * Mirrors packages/config identity helpers without coupling the Pages build
 * to the full monorepo package graph.
 */

export const PRODUCT_NAME = 'BlackStory' as const;
export const TAGLINE = 'History, pinned to place.' as const;
export const SUPPORT_LINE = 'People. Places. Evidence. Context.' as const;
export const REPO_URL = 'https://github.com/geraldmaron/blackstory' as const;
export const SITE_DESCRIPTION =
  'BlackStory docs: why the project exists, how place-connected records reach the public, and how to work in the monorepo.' as const;

export const THEME_STORAGE_KEY = 'ds-theme' as const;

/** Inline bootstrap to avoid flash of wrong theme before hydration. */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var s=localStorage.getItem(k);var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var t=(s==='light'||s==='dark')?s:(d?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;
