/**
 * Client surface-class hook. `/` is a reading door unless the URL asks for the Atlas, so
 * header, footer, page wrapper and plate posture must see the query, not only the pathname.
 */
'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { surfaceClassFor, type SurfaceClass } from './surface-classes';

export function useSurfaceClass(): SurfaceClass | null {
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();
  return surfaceClassFor(pathname, pathname === '/' ? searchParams.toString() : '');
}
