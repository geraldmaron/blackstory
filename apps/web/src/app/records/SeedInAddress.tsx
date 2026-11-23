/**
 * Writes the shuffle seed this render drew into the address, so Back and reload ask for the same
 * order instead of a fresh shuffle. `replaceState` only: no navigation, no request, and the
 * server's canonical and CDN key for bare `/records` are untouched.
 */
'use client';

import { useEffect } from 'react';

export function SeedInAddress({ seed }: { readonly seed: string }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('seed')) return;
    url.searchParams.set('seed', seed);
    window.history.replaceState(window.history.state, '', url);
  }, [seed]);
  return null;
}
