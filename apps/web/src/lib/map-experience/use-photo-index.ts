/**
 * One fetch of a surface's photo index, shared by every consumer on the page.
 *
 * Explore has two readers of `/atlas/photos`: the hover card over a pin and the record sheet's
 * mast. Each used to be free to fetch on its own; a module-level cache keyed by URL means the
 * first consumer to want the index starts the request and every later one joins it, on this
 * navigation and the next. Fetching is lazy: nothing happens until a consumer passes
 * `enabled: true`, so a surface's first paint never pays for the release's photo count.
 *
 * Fails closed. A failed request resolves to `null`, which every consumer already treats as "no
 * photo", and the failure is not retried for the life of the page: a photo index that is down is
 * down, and one hover per pin should not hammer it.
 */
'use client';

import { useEffect, useState } from 'react';
import type { PinPhotoView } from './entity-photo-index';

export type PhotoIndex = Readonly<Record<string, PinPhotoView>>;

const cache = new Map<string, Promise<PhotoIndex | null>>();

function loadPhotoIndex(url: string): Promise<PhotoIndex | null> {
  const existing = cache.get(url);
  if (existing) return existing;
  const request = fetch(url)
    .then((response) => (response.ok ? (response.json() as Promise<PhotoIndex>) : null))
    .catch(() => null);
  cache.set(url, request);
  return request;
}

/** Test seam: forget every cached request. */
export function resetPhotoIndexCache(): void {
  cache.clear();
}

export function usePhotoIndex(url: string, enabled: boolean): PhotoIndex | null {
  const [index, setIndex] = useState<PhotoIndex | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadPhotoIndex(url).then((data) => {
      if (!cancelled && data) setIndex(data);
    });
    return () => {
      cancelled = true;
    };
  }, [url, enabled]);

  return index;
}
