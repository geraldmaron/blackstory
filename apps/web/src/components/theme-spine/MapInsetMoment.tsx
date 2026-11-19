/**
 * A chapter's `mapInset` block: the record's own RecordMap, framed at the zoom its stored
 * precision allows, with the hand-off to /explore that selects it inside its place. The inset is
 * a locator inside the reading column, so it is the same embedded map every record page uses (the
 * /explore plate, mark and place token included; `docs/ui/patterns-place-map.md`, "Embeds"), not
 * the persistent plate borrowed into a slot. A server component: the place token needs the catalog.
 */
import React from 'react';
import { RecordMap } from '../map-embed/RecordMap';
import { loadRecordPlace } from '../../lib/map-experience/record-place';
import { exploreRecordHref } from '../../lib/map-experience/url-state';

void React;

export type MapInsetMomentProps = {
  readonly entityId: string;
  readonly label: string;
  readonly lat: number;
  readonly lng: number;
  readonly precision:
    'state' | 'county' | 'city' | 'neighborhood' | 'campus' | 'institution' | 'site' | 'address';
  readonly className?: string;
};

export async function MapInsetMoment({
  entityId,
  label,
  lat,
  lng,
  precision,
  className,
}: MapInsetMomentProps) {
  const place = await loadRecordPlace(entityId);
  return (
    <RecordMap
      lat={lat}
      lng={lng}
      label={label}
      precision={precision}
      exploreHref={place ? place.href : exploreRecordHref(entityId)}
      {...(place ? { place } : {})}
      {...(className ? { className } : {})}
    />
  );
}
