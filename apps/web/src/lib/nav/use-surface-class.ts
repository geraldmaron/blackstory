/**
 * Client surface-class hook. Class is the pathname only: `/` is always the reading door.
 */
'use client';

import { usePathname } from 'next/navigation';
import { surfaceClassFor, type SurfaceClass } from './surface-classes';

export function useSurfaceClass(): SurfaceClass | null {
  const pathname = usePathname() || '/';
  return surfaceClassFor(pathname);
}
