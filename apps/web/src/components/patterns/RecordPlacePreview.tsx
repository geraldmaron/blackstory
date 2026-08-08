'use client';

/**
 * A record's place block: the plate, borrowed into the anatomy panel.
 *
 * WHAT CHANGED AND WHY (SP-08, repo-92n2.8). This used to lazily mount `EntityLocationMap`, a
 * second MapLibre instance, so a record page held two GL contexts at once. It now publishes a slot
 * and the one persistent plate moves into it. `plate-posture.ts` already anticipates this
 * component by name: a record page RESTS in the Framed posture precisely because its place block
 * always has something to frame.
 *
 * THE SHARED-SURFACE CASE, which is the whole reason this is not a plain `MapMoment` call.
 * `RecordAnatomyPanel` renders on the record page AND inside the Atlas's record sheet, which
 * floats OVER the live plate. A sheet cannot borrow the plate it is floating over, so
 * `framedClaimAllowed` refuses the claim on the Instrument and the slot stays idle. The default
 * idle line tells the reader to scroll, which is false there — the plate is never coming. Passing
 * an idle line that states the plate's actual location is honest on both surfaces, and no caller
 * has to know which one it is on.
 *
 * The external maps link is kept: it is the one affordance that works regardless of posture,
 * WebGL, or whether the reader is in a sheet.
 */
import React from 'react';
import { MapMoment } from '../room';
import { buildExternalMapsSearchUrl } from '../../lib/geography/external-maps-url';
import { zoomForLocationPrecision } from '../../lib/map-experience/geo-precision';
import { MapsExternalLink } from '../map-experience/MapsExternalLink';

void React;

export type RecordPlacePreviewProps = {
  readonly lat: number;
  readonly lng: number;
  readonly label: string;
  readonly precision: 'county' | 'city' | 'neighborhood' | 'campus' | 'institution';
  /** Precision caveat shown with the block, when the record carries one. */
  readonly caption?: string;
};

export function RecordPlacePreview({
  lat,
  lng,
  label,
  precision,
  caption,
}: RecordPlacePreviewProps) {
  const mapsHref = buildExternalMapsSearchUrl({ lat, lng });

  return (
    <figure className="ds-record-anatomy__place">
      <MapMoment
        camera={{ center: [lng, lat], zoom: zoomForLocationPrecision(precision) }}
        note={caption ?? label}
        idle="The map of this place is on the Atlas."
      />
      {mapsHref ? (
        <MapsExternalLink
          href={mapsHref}
          placeLabel={label}
          className="ds-record-anatomy__place-link"
          title={`Open ${label} in your maps app`}
        >
          Open in your maps app
        </MapsExternalLink>
      ) : null}
    </figure>
  );
}
