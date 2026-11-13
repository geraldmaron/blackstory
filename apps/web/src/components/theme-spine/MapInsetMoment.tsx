/**
 * A chapter's `mapInset` block: the record's own RecordMap, framed at the zoom its stored
 * precision allows, with the hand-off to /explore that selects it there. The inset is a locator
 * inside the reading column, so it is the same embedded map every record page uses, not the
 * persistent plate borrowed into a slot.
 */
import React from 'react';
import { RecordMap } from '../map-embed/RecordMap';
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

export function MapInsetMoment({
  entityId,
  label,
  lat,
  lng,
  precision,
  className,
}: MapInsetMomentProps) {
  return (
    <RecordMap
      lat={lat}
      lng={lng}
      label={label}
      precision={precision}
      exploreHref={exploreRecordHref(entityId)}
      {...(className ? { className } : {})}
    />
  );
}
