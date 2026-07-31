/**
 * Document footer gate for the public shell.
 *
 * The Instrument is a full-viewport composition with the document scroll locked, so a mega
 * footer there has nowhere to live and would compete with the plate. Story's outro will supply
 * its own footer at the end of the document (SP-10); every other class gets this one.
 *
 * Reads the same surface class registry as the header and `shell.css`.
 */

'use client';

import { usePathname } from 'next/navigation';
import { surfaceClassFor } from '../lib/nav/surface-classes';
import { SiteFooter } from './SiteFooter';

export function SiteShellFooter() {
  const pathname = usePathname() || '/';
  if (surfaceClassFor(pathname) === 'instrument') return null;
  return <SiteFooter />;
}
