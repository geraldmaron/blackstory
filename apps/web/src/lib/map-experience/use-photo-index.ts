/**
 * Photos for the records a surface is showing, fetched by id.
 *
 * The full photo index for a release is about half a megabyte, and Explore needs only the photos
 * of the dozen rows in view, the inspected record and the hovered pin. Each consumer asks for its
 * ids; ids nobody has asked for yet go out in one `?ids=` request per call (`pickPhotoIds` serves
 * it on the route side), and every answer, including "no photo", is cached per surface URL for the
 * life of the page, so a row scrolled back into view never asks twice.
 *
 * Fails closed: a failed request resolves its ids to "no photo" and is not retried, which every
 * consumer already renders as the sand kind tile or no card.
 */
'use client';

import { useEffect, useState } from 'react';
import type { PinPhotoView } from './entity-photo-index';

export type PhotoIndex = Readonly<Record<string, PinPhotoView>>;

/** Ids per request: a phone list shows about 8 rows and a tall desktop list about 20. */
export const PHOTO_IDS_PER_REQUEST = 40;

const cache = new Map<string, Map<string, Promise<PinPhotoView | null>>>();

function requestPhotos(url: string, ids: readonly string[]): void {
  const seen = cache.get(url) ?? new Map<string, Promise<PinPhotoView | null>>();
  cache.set(url, seen);
  const missing = [...new Set(ids)].filter((id) => !seen.has(id));
  for (let start = 0; start < missing.length; start += PHOTO_IDS_PER_REQUEST) {
    const batch = missing.slice(start, start + PHOTO_IDS_PER_REQUEST);
    const separator = url.includes('?') ? '&' : '?';
    const response = fetch(`${url}${separator}ids=${encodeURIComponent(batch.join(','))}`)
      .then((res) => (res.ok ? (res.json() as Promise<PhotoIndex>) : ({} as PhotoIndex)))
      .catch(() => ({}) as PhotoIndex);
    for (const id of batch)
      seen.set(
        id,
        response.then((index) => index[id] ?? null),
      );
  }
}

/**
 * The photos for `ids` that exist, as they arrive. An empty list asks for nothing. Earlier
 * answers stay in the returned map, so a row scrolling out and back keeps its photo.
 */
export function usePhotos(url: string, ids: readonly string[]): PhotoIndex {
  const key = ids.join(',');
  const [photos, setPhotos] = useState<PhotoIndex>({});

  useEffect(() => {
    if (key === '') return;
    const wanted = key.split(',');
    requestPhotos(url, wanted);
    const seen = cache.get(url)!;
    let canceled = false;
    void Promise.all(wanted.map((id) => seen.get(id))).then((views) => {
      if (canceled) return;
      const found: Record<string, PinPhotoView> = {};
      views.forEach((view, i) => {
        if (view) found[wanted[i]!] = view;
      });
      if (Object.keys(found).length > 0) setPhotos((prev) => ({ ...prev, ...found }));
    });
    return () => {
      canceled = true;
    };
  }, [url, key]);

  return photos;
}
