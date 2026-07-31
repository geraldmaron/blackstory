/**
 * Site header gate for the public shell.
 *
 * The Instrument renders its own command bar (`components/shell/CommandBar.tsx`), which is the
 * v9 replacement for this header rather than an addition to it. Rendering both would put two
 * brand lockups and two navigations on one surface, and would push the map plate down by 56px
 * on the one route where the map is the product.
 *
 * The decision reads the surface class registry — the same table `shell.css` and the footer
 * read — so the three can never disagree about which surface is the Instrument. It stays a
 * render gate rather than a `display: none` so the Atlas ships no second, hidden navigation.
 */

'use client';

import { usePathname } from 'next/navigation';
import { surfaceClassFor } from '../lib/nav/surface-classes';
import { SiteHeader } from './SiteHeader';

export function SiteShellHeader() {
  const pathname = usePathname() || '/';
  if (surfaceClassFor(pathname) === 'instrument') return null;
  return <SiteHeader />;
}
