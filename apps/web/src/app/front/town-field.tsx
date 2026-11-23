/**
 * Scene 4, "Your story": a town field (docs/ui/DESIGN.md section 9.7).
 *
 * The field is Explore's own place search (`PlaceControl`): typed text only, resolved by the
 * archive's `/locate/api`. "Use my location" is a separate button that asks the browser only
 * when pressed (`useLocateMe`). The answer is worked out here, in the browser, from the pins the
 * page already holds: the nearest records and how far, or plainly that nothing near is
 * researched yet.
 *
 * Privacy: the typed town and a device position live in this component's state and nowhere
 * else. Neither is written to the URL, to storage or to a log, and a device position is never
 * sent to the server at all.
 */
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { buttonClassName } from '@repo/ui';
import { PlaceControl, type PlaceResolved } from '../../components/map-experience/PlaceControl';
import { ToastStack, useToasts } from '../../components/patterns/Toast';
import type { ExploreMapFeatureCollection } from '../../lib/map-experience/build-explore-map-source';
import {
  formatExploreDistance,
  type ExploreGeoPoint,
} from '../../lib/map-experience/explore-place-radius';
import { nearbyDistances, type NearbyArea } from '../../lib/map-experience/nearby';
import { useLocateMe } from '../explore/hooks/use-locate-me';
import { DoorRecordLink } from '../door-record-link';
import { legText } from './journey';
import { useSetRetellingTown, type RetellingStop } from './retelling-film';

void React;

/** "Near" a town: fifty miles. Past that the page says nothing near is researched yet. */
export const NEAR_METERS = 80_467;
const NEAR_LABEL = '50 miles';
const SHOWN = 3;

export type NearRecord = {
  readonly id: string;
  readonly name: string;
  readonly href: string;
  readonly meters: number;
};

/** The records nearest a point, nearest first, and whether any is near. Pure. */
export function nearestRecords(
  features: ExploreMapFeatureCollection['features'],
  center: ExploreGeoPoint,
  count = SHOWN,
): { readonly near: readonly NearRecord[]; readonly nearest: NearRecord | null } {
  const distances = nearbyDistances(features, center);
  const ranked = features
    .flatMap((feature) => {
      const meters = distances.get(feature.properties.entityId);
      return meters === undefined || !feature.properties.href
        ? []
        : [
            {
              id: feature.properties.entityId,
              name: feature.properties.displayName,
              href: feature.properties.href,
              meters,
            },
          ];
    })
    .sort((a, b) => a.meters - b.meters);
  return {
    near: ranked.filter((record) => record.meters <= NEAR_METERS).slice(0, count),
    nearest: ranked[0] ?? null,
  };
}

export function TownField({
  pins,
  nextSceneId,
  nextStop,
}: {
  readonly pins: ExploreMapFeatureCollection;
  /** The scene after this one, whose travel line can then say how far it is from the town. */
  readonly nextSceneId: string;
  readonly nextStop: RetellingStop | null;
}) {
  const setTown = useSetRetellingTown();
  const toasts = useToasts();
  const [place, setPlace] = useState<{ center: ExploreGeoPoint; label: string } | null>(null);
  // Off until the script is running. A plain form would otherwise submit by itself and put the
  // typed town in the address.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const choose = useCallback(
    (center: ExploreGeoPoint, label: string) => {
      setPlace({ center, label });
      setTown({ lngLat: [center.lng, center.lat] });
      const leg = document.querySelector(`[data-leg="${nextSceneId}"]`);
      if (leg && nextStop) {
        leg.textContent = `${legText([center.lng, center.lat], nextStop.lngLat)} to ${nextStop.place}`;
      }
    },
    [nextSceneId, nextStop, setTown],
  );

  const onNearby = useCallback(
    (area: NearbyArea | null) => {
      if (area) choose(area.center, 'your location');
    },
    [choose],
  );
  const { locate, status } = useLocateMe(toasts, onNearby);

  const onResolved = useCallback(
    (resolved: PlaceResolved) => {
      if (resolved.kind === 'place') {
        const { lat, lng } = resolved.target.viewport;
        choose({ lat, lng }, resolved.target.label);
        return;
      }
      const feature = pins.features.find((pin) => pin.properties.entityId === resolved.entityId);
      if (feature?.geometry.type !== 'Point') return;
      const [lng, lat] = feature.geometry.coordinates;
      if (lng !== undefined && lat !== undefined) {
        choose({ lat, lng }, feature.properties.displayName);
      }
    },
    [choose, pins],
  );

  const answer = useMemo(
    () => (place ? nearestRecords(pins.features, place.center) : null),
    [pins, place],
  );
  const locating = status === 'locating';

  return (
    <div className="ds-town" data-ground="paper" data-ground-fixed="">
      <p className="ds-town__prompt">Type a town.</p>
      <fieldset className="ds-town__fields" disabled={!ready}>
        <legend className="ds-visually-hidden">Find the records nearest a town</legend>
        <PlaceControl
          catalogFeatures={pins.features}
          onResolved={onResolved}
          placed={false}
          radiusId="all"
          onRadiusChange={() => undefined}
        />
        <button
          type="button"
          className={buttonClassName('secondary', 'ds-town__locate')}
          onClick={locate}
          disabled={locating}
          aria-busy={locating || undefined}
        >
          {locating ? 'Finding your location' : 'Use my location'}
        </button>
      </fieldset>
      <noscript>
        <p className="ds-town__noscript">This field needs JavaScript to answer.</p>
      </noscript>
      <div className="ds-town__answer" role="status" aria-live="polite">
        {place && answer ? (
          answer.near.length > 0 ? (
            <>
              <p>The nearest records to {place.label}</p>
              <ul>
                {answer.near.map((record) => (
                  <li key={record.id}>
                    <DoorRecordLink href={record.href}>{record.name}</DoorRecordLink>
                    <span>{formatExploreDistance(record.meters)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>
              Nothing within {NEAR_LABEL} of {place.label} is researched yet.
              {answer.nearest ? (
                <>
                  {' '}
                  The nearest record is{' '}
                  <DoorRecordLink href={answer.nearest.href}>
                    {answer.nearest.name}
                  </DoorRecordLink>, {formatExploreDistance(answer.nearest.meters)}.
                </>
              ) : null}
            </p>
          )
        ) : null}
      </div>
      <ToastStack toasts={toasts.toasts} onDismiss={toasts.dismiss} />
    </div>
  );
}
