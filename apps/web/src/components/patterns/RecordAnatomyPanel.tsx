/**
 * Shared record anatomy panel: compact map preview beside inline fact rows
 * (Kind / Where / Era / Evidence). Used on home featured records and Explore spotlight.
 */
import React from 'react';
import type { PublicEntityView } from '../../data/public-seed';
import { buildExternalMapsSearchUrl } from '../../lib/geography/external-maps-url';
import { resolvePublicAddressLine } from '../../lib/geography/public-address';
import { MapsExternalLink } from '../map-experience/MapsExternalLink';
import { EditionFactIcon, type EditionFactIconProps } from './EditionFactIcon';
import { RecordPlacePreview } from './RecordPlacePreview';
// The panel owns its own stylesheet rather than trusting each route to import it. `/entity/[id]`
// did not, and the place block fell back to the UA `<figure>` margin — 40px a side inside a 192px
// rail, which is what left the map 112px wide.
import './record-anatomy.css';

void React;

export type RecordAnatomyFactKey = 'kind' | 'where' | 'era' | 'evidence';

export type RecordAnatomyFact = {
  readonly key: RecordAnatomyFactKey;
  readonly label: string;
  readonly value: React.ReactNode;
  readonly icon: EditionFactIconProps;
};

export type RecordAnatomyPlace = {
  readonly lat: number;
  readonly lng: number;
  readonly label: string;
  readonly precision: PublicEntityView['locationPrecision'];
  readonly precisionCaption?: string;
};

export type RecordAnatomyPanelProps = {
  readonly facts: readonly RecordAnatomyFact[];
  readonly place?: RecordAnatomyPlace;
  readonly className?: string;
  readonly 'aria-label'?: string;
  /**
   * When false, Where stays plain text. Use that when a Visit block on the same surface
   * already owns Open in maps / Get directions.
   */
  readonly linkWhereToMaps?: boolean;
};

function whereMapsQuery(fact: RecordAnatomyFact, place: RecordAnatomyPlace): string {
  if (typeof fact.value === 'string' && fact.value.trim().length > 0) {
    return fact.value.trim();
  }
  return resolvePublicAddressLine({
    locationLabel: place.label,
    locationPrecision: place.precision,
    kind: 'place',
  });
}

function whereFactValue(
  fact: RecordAnatomyFact,
  place: RecordAnatomyPlace | undefined,
  linkWhereToMaps: boolean,
): React.ReactNode {
  if (fact.key !== 'where' || !place || !linkWhereToMaps) {
    return fact.value;
  }

  const query = whereMapsQuery(fact, place);
  const href = buildExternalMapsSearchUrl({
    lat: place.lat,
    lng: place.lng,
    query,
  });
  if (!href) {
    return fact.value;
  }

  const placeLabel = query;

  return (
    <MapsExternalLink
      className="ds-record-anatomy__fact-link"
      href={href}
      placeLabel={placeLabel}
      title={`Where: ${placeLabel}. Open in your maps app.`}
    >
      {fact.value}
    </MapsExternalLink>
  );
}

function PlaceSlot({ place }: { readonly place: RecordAnatomyPlace | undefined }) {
  if (place) {
    return <RecordPlacePreview lat={place.lat} lng={place.lng} label={place.label} />;
  }

  return (
    <figure
      className="ds-record-anatomy__place ds-record-anatomy__place--empty"
      aria-label="Place not pinned on the archive map"
    >
      <p className="ds-record-anatomy__place-empty-label">Place not pinned</p>
    </figure>
  );
}

export function RecordAnatomyPanel({
  facts,
  place,
  className,
  'aria-label': ariaLabel = 'Record at a glance',
  linkWhereToMaps = true,
}: RecordAnatomyPanelProps) {
  const rootClass = className ? `ds-record-anatomy ${className}` : 'ds-record-anatomy';

  return (
    <section className={rootClass} aria-label={ariaLabel}>
      <div className="ds-record-anatomy__body">
        <PlaceSlot place={place} />
        <dl className="ds-record-anatomy__facts">
          {facts.map((fact) => (
            <div key={fact.key} className="ds-record-anatomy__fact ds-record-anatomy__fact--inline">
              <dt className="ds-record-anatomy__fact-label">
                <EditionFactIcon
                  {...fact.icon}
                  {...(fact.key === 'kind' ? { muted: true as const } : {})}
                />
                {fact.label}
              </dt>
              <dd className="ds-record-anatomy__fact-value">
                {whereFactValue(fact, place, linkWhereToMaps)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {place?.precisionCaption ? (
        <p className="ds-record-anatomy__precision">{place.precisionCaption}</p>
      ) : null}
    </section>
  );
}
