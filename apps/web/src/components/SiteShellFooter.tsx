/**
 * Document footer gate for the public shell. Explore is a dedicated map surface —
 * omit the mega footer there so it never competes with the full-viewport canvas.
 */

'use client';

import { usePathname } from 'next/navigation';
import { isExploreMapShell } from './explore-map-shell';
import { SiteFooter } from './SiteFooter';

export function SiteShellFooter() {
  const pathname = usePathname() || '/';
  if (isExploreMapShell(pathname)) return null;
  return <SiteFooter />;
}
