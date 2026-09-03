/**
 * Site header for the public shell.
 *
 * One bar, every surface. The site used to run two navigation patterns at once: Explore rendered
 * `components/shell/CommandBar.tsx` and every other room rendered `SiteHeader`, a fourteen-item bar
 * with a `MORE` menu hiding nine of them. A reader crossing from the map to a reading room met a
 * different header, in a different place, with a different set of destinations — and the two
 * disagreed about what the site contained.
 *
 * Explore still mounts its own `CommandBar` inside `AtlasExperience`, because there the bar needs
 * the mode toggle, the palette, the saved drawer and the shortcut sheet, all of which are that
 * surface's client state. This renders the same component without them: brand, search, Find
 * (Explore / Records), Rooms, and the theme switch. Same component, same position, same artwork.
 *
 * The gate reads the surface class registry, the same table `shell.css` and the footer read, so the
 * three cannot disagree about which surface is the Instrument. It stays a render gate rather than a
 * `display: none` so Explore ships no second, hidden navigation.
 */

'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { toggleDocumentTheme } from '@repo/ui';
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
  if (surfaceClassFor(pathname) === 'instrument') return null;
  return <CommandBar className="ds-bar--room" onToggleTheme={toggleDocumentTheme} />;
}

function SiteShellHeaderFromSearch() {
  if (useSurfaceClass() === 'instrument') return null;
  // No `recordCount`: the count is a promise only a surface holding the index can keep, and a
  // reading room does not load one. The placeholder drops the number rather than inventing it.
  return <CommandBar className="ds-bar--room" onToggleTheme={toggleDocumentTheme} />;
}
