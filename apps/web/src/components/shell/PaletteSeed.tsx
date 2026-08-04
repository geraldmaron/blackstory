/**
 * Publishes the current path to the bar search as a sanitised query, for as long as it is mounted.
 *
 * Mounted by `not-found.tsx` only. The 404 is the one surface where the path a reader is standing
 * on is a better query than an empty field, and it is also the one surface that cannot know its
 * own path on the server — `not-found.tsx` receives no params — so this is a client leaf rather
 * than a prop.
 *
 * It clears on unmount, which is what keeps the seed from following a reader off the 404 and into
 * the next room's search box.
 */
'use client';

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { sanitizePaletteSeed, setPaletteSeed } from '../../lib/shell/palette-seed';

void React;

export function PaletteSeed() {
  const pathname = usePathname();

  useEffect(() => {
    setPaletteSeed(sanitizePaletteSeed(pathname ?? ''));
    return () => setPaletteSeed('');
  }, [pathname]);

  return null;
}
