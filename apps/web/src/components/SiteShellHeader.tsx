/**
 * Site header gate for the public shell.
 *
 * The Atlas renders its own command bar (`components/shell/CommandBar.tsx`), which is the v9
 * replacement for this header rather than an addition to it. Rendering both would put two brand
 * lockups and two navigations on one surface, and would push the map plate down by 56px on the
 * one route where the map is the product.
 */

'use client';

import { usePathname } from 'next/navigation';
import { isExploreMapShell } from './explore-map-shell';
import { SiteHeader } from './SiteHeader';

export function SiteShellHeader() {
  const pathname = usePathname() || '/';
  if (isExploreMapShell(pathname)) return null;
  return <SiteHeader />;
}
