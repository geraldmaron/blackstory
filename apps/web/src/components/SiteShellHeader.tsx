/**
 * Site header for the public shell.
 *
 * One bar, every surface. The site used to run two navigation patterns at once: the Atlas rendered
 * `components/shell/CommandBar.tsx` and every other room rendered `SiteHeader`, a fourteen-item bar
 * with a `MORE` menu hiding nine of them. A reader crossing from the map to a reading room met a
 * different header, in a different place, with a different set of destinations — and the two
 * disagreed about what the site contained.
 *
 * The Atlas still mounts its own `CommandBar` inside `AtlasExperience`, because there the bar needs
 * the mode toggle, the palette, the saved drawer and the shortcut sheet, all of which are that
 * surface's client state. This renders the same component without them: brand, a search slot that
 * links to the record index, Atlas, Library, and the theme switch. Same component, same position,
 * same artwork — the parts that cannot work off the Atlas are absent rather than inert.
 *
 * The gate reads the surface class registry, the same table `shell.css` and the footer read, so the
 * three cannot disagree about which surface is the Instrument. It stays a render gate rather than a
 * `display: none` so the Atlas ships no second, hidden navigation.
 */

'use client';

import { usePathname } from 'next/navigation';
import { toggleDocumentTheme } from '@repo/ui';
import { surfaceClassFor } from '../lib/nav/surface-classes';
import { CommandBar } from './shell/CommandBar';

export function SiteShellHeader() {
  const pathname = usePathname() || '/';
  if (surfaceClassFor(pathname) === 'instrument') return null;
  // No `recordCount`: the count is a promise only a surface holding the index can keep, and a
  // reading room does not load one. The placeholder drops the number rather than inventing it.
  return <CommandBar className="ds-bar--room" onToggleTheme={toggleDocumentTheme} />;
}
