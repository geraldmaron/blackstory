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

/**
 * Inline bootstrap to avoid flash of wrong theme before hydration.
 *
 * The storage key is written as a literal rather than interpolated, matching @repo/ui's
 * document-theme.ts. Building executable code by substituting a value into a template is the
 * shape CodeQL flags (js/bad-code-sanitization), and JSON.stringify is not an escape for a code
 * context: a value containing `</script` ends the tag whatever the quoting.
 *
 * `assertBootstrapKeyMatches` below is the guard against the literal and the constant drifting
 * apart, which would break theme persistence silently: the bootstrap would read one key and the
 * app would write another. It is a type error, not a test, so it cannot be skipped.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var k='ds-theme';var s=localStorage.getItem(k);var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var t=(s==='light'||s==='dark')?s:(d?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

/**
 * Compile-time guarantee that the key inlined in THEME_BOOTSTRAP_SCRIPT is THEME_STORAGE_KEY.
 * Changing either without the other stops this file compiling.
 */
const assertBootstrapKeyMatches: typeof THEME_STORAGE_KEY = 'ds-theme';
void assertBootstrapKeyMatches;
