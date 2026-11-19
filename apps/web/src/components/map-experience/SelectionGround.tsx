/**
 * The selected record's photograph as the ground around the map (Explore's browse posture), the
 * home tour's treatment (`.ds-door__echo`) carried to a selection: clear over the record's own pin
 * and deepening outward, so the map reads through it everywhere and plainly at the record.
 *
 * The clear circle follows the pin, not the screen's middle: on a phone the camera frames the pin
 * in the open band above the sheet, and the cutout stays there with it while the reader pans. The
 * layer takes no pointer events, so the map under it keeps every tap, drag and pinch.
 *
 * Only for a record the photo index serves (`/atlas/photos`), which already leaves quiet records
 * (violence-adjacent or sensitive) out; the credit stays in the inspector beside the words.
 */
'use client';

import React, { useEffect, useRef } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import './selection-ground.css';

void React;

export type SelectionGroundProps = {
  readonly map: MapLibreMap | null;
  readonly lngLat: readonly [number, number];
  readonly photoUrl: string;
  /** A portrait keeps the face in the crop. */
  readonly person: boolean;
};

export function SelectionGround({ map, lngLat, photoUrl, person }: SelectionGroundProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [lng, lat] = lngLat;

  /* The pin's screen point, written straight to the layer on every camera frame (no render). */
  useEffect(() => {
    const node = ref.current;
    if (!map || !node) return;
    const place = () => {
      const box = map.getContainer().getBoundingClientRect();
      const point = map.project([lng, lat]);
      node.style.setProperty('--ds-ground-x', `${box.left + point.x}px`);
      node.style.setProperty('--ds-ground-y', `${box.top + point.y}px`);
    };
    place();
    map.on('move', place);
    map.on('resize', place);
    return () => {
      map.off('move', place);
      map.off('resize', place);
    };
  }, [map, lng, lat]);

  return (
    <>
      <div className="ds-xground" ref={ref} aria-hidden="true">
        <span className={person ? 'ds-plate__tone ds-plate--upper' : 'ds-plate__tone'}>
          {/* eslint-disable-next-line @next/next/no-img-element -- public CDN URL, the record's own photo */}
          <img className="ds-plate__img" src={photoUrl} alt="" decoding="async" />
        </span>
      </div>
      {/* Under the words, outside the photograph's mask so the cutout never thins it. */}
      <div className="ds-xground-wash" aria-hidden="true" />
    </>
  );
}
