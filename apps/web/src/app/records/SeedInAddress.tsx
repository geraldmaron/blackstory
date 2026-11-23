/**
 * Writes the shuffle seed this render drew into the address, so Back and reload ask for the same
 * order instead of a fresh shuffle. `replaceState` only: no navigation, no request, and the
 * server's canonical and CDN key for the bare list are untouched.
 */
'use client';

import { useEffect } from 'react';

export function SeedInAddress({ seed }: { readonly seed: string }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('seed')) return;
    url.searchParams.set('seed', seed);
    // The page is last in every address the list prints; keep one spelling in history too.
    const page = url.searchParams.get('page');
    if (page !== null) {
      url.searchParams.delete('page');
      url.searchParams.set('page', page);
    }
    window.history.replaceState(window.history.state, '', url);
  }, [seed]);
  return null;
}
