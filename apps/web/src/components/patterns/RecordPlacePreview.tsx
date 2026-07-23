'use client';

/**
 * Compact MapLibre place preview for record anatomy panels. Reuses EntityLocationMap
 * styling and dignity palette; defers WebGL until the card hydrates.
 */
import React from 'react';
import dynamic from 'next/dynamic';
import type { EntityLocationMapProps } from '../entity/EntityLocationMap';
import { buildExternalMapsSearchUrl } from '../../lib/geography/external-maps-url';
import { MapsExternalLink } from '../map-experience/MapsExternalLink';

void React;

const EntityLocationMap = dynamic(
  () => import('../entity/EntityLocationMap').then((mod) => mod.EntityLocationMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="ds-record-anatomy__place-shell"
        data-load-state="loading"
        role="img"
        aria-label="Map preview loading"
      />
    ),
  },
);

export type RecordPlacePreviewProps = EntityLocationMapProps;

export function RecordPlacePreview(props: RecordPlacePreviewProps) {
  const { caption: _caption, lat, lng, label, ...mapProps } = props;
  void _caption;
  const mapsHref = buildExternalMapsSearchUrl({ lat, lng });
  const map = (
    <EntityLocationMap lat={lat} lng={lng} label={label} {...mapProps} />
  );

  return (
    <figure className="ds-record-anatomy__place">
      {mapsHref ? (
        <MapsExternalLink
          href={mapsHref}
          placeLabel={label}
          className="ds-record-anatomy__place-link"
          title={`Open ${label} in your maps app`}
        >
          {map}
        </MapsExternalLink>
      ) : (
        map
      )}
    </figure>
  );
}
