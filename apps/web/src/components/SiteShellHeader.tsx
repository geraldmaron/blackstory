/**
 * Site header for the public shell: one bar on every surface, `/explore` included.
 *
 * The search-params variant prefills the header search from `?q`, so on `/records?q=church` the
 * field says "church". `useSearchParams` suspends a statically rendered route, so the
 * pathname-only variant is the fallback and renders the same bar with an empty field.
 *
 * The gate reads the surface class registry, the same table `shell.css` and the footer read, so the
 * three cannot disagree about which surface renders chrome. It stays a render gate rather than a
 * `display: none` so an endpoint ships no hidden navigation.
 */

'use client';

import { Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { surfaceClassFor } from '../lib/nav/surface-classes';
import { useSurfaceClass } from '../lib/nav/use-surface-class';
import { CommandBar } from './shell/CommandBar';

export function SiteShellHeader() {
  return (
    <Suspense fallback={<SiteShellHeaderFromPath />}>
      <SiteShellHeaderFromSearch />
    </Suspense>
  );
}

function SiteShellHeaderFromPath() {
  const pathname = usePathname() || '/';
  const surface = surfaceClassFor(pathname);
  if (surface === 'instrument' || surface === null) return null;
  return <CommandBar />;
}

function SiteShellHeaderFromSearch() {
  const surface = useSurfaceClass();
  const query = useSearchParams()?.get('q')?.trim() || undefined;
  if (surface === 'instrument' || surface === null) return null;
  return <CommandBar query={query} />;
}
