/**
 * The reader's two standing choices about the world (design-direction-v11.md §4.1, §4.3).
 *
 * Read from storage at the point of use, not from a `<html>` attribute set by a head script: the
 * one inline script the document carries is CSP-hashed (layout.tsx), and neither choice changes
 * the first paint, which is server HTML either way.
 */
export const HOLD_STILL_KEY = 'ds-hold-still';
export const READ_AS_DOCUMENTS_KEY = 'ds-read-as-documents';

function stored(key: string): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/** Every camera move is a cut, as under `prefers-reduced-motion`. */
export function holdStill(): boolean {
  return stored(HOLD_STILL_KEY);
}

/** No canvas anywhere: every surface is the document it is without WebGL. */
export function readAsDocuments(): boolean {
  return stored(READ_AS_DOCUMENTS_KEY);
}

export function setWorldPref(key: string, on: boolean): void {
  try {
    if (on) window.localStorage.setItem(key, '1');
    else window.localStorage.removeItem(key);
  } catch {
    // Without storage the choice lasts for this page only.
  }
}
