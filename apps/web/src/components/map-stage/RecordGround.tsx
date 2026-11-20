'use client';

/**
 * Ground (design-direction-v11.md §4.1): a record page hands the persistent plate its own record
 * and its typed neighbors, and the plate paints full-bleed behind the masthead. No second map:
 * this is the one `MapStage`, the same instance the Door and Explore drive.
 *
 * Precision governs the camera (P-03). Only a site-precision record gets the pitched frame and
 * imagery; anything coarser is framed flat, no closer than its precision allows. A quiet record
 * (violence-adjacent) is a cut, flat, on the plain plate (P-04).
 *
 * An edge is drawn only between this record and a neighbor that came from a typed relationship
 * row, and it carries that relationship's sentence (P-02). Neighbors without a public point are
 * not drawn; the sheet's "Connected records" lists every one of them.
 */
import React, { useEffect } from 'react';

import { useRouter } from 'next/navigation';
import type { ExploreMapFeature } from '../../lib/map-experience/build-explore-map-source';
import type { HistoryEdgeLineCollection } from '../../lib/map-experience/build-history-edge-lines';
import { recordMarkFor, zoomForLocationPrecision } from '../../lib/map-experience/geo-precision';
import { nationalFieldPatch } from '../../lib/map-experience/national-field';
import { useOptionalMapStage } from './MapStage';

/** Closest Ground frame: near enough to read the block, never an address-level view. */
void React;

export const GROUND_MAX_ZOOM = 13;
/**
 * 45, not steeper: a tilted view reaches toward the horizon and fetches imagery for all of it.
 * At 55 a desktop record page pulled about twice the close-up tiles it does at 40
 * (design-direction-v11.md §14.3).
 */
export const GROUND_SITE_PITCH = 45;

export type RecordGroundNeighbor = {
  readonly feature: ExploreMapFeature;
  /** The typed relationship in words, as the sheet prints it. */
  readonly relation: string;
};

export type RecordGroundProps = {
  readonly record: ExploreMapFeature;
  readonly neighbors: readonly RecordGroundNeighbor[];
  readonly quiet?: boolean;
};

/** The camera a record's stored precision allows. Exported for the test. */
export function groundFrameFor(precision: string, quiet: boolean) {
  const site = recordMarkFor(precision) === 'dot' && !quiet;
  return {
    zoom: Math.min(zoomForLocationPrecision(precision), GROUND_MAX_ZOOM),
    pitch: site ? GROUND_SITE_PITCH : 0,
    imagery: site,
  };
}

/**
 * Where the record sits on screen: the middle of what the sheet leaves uncovered. Wide, the
 * sheet is the right column (record-page.css, from 72rem), so the frame is padded by its width;
 * narrower, the sheet is under the masthead and the frame is the masthead's own box.
 */
function groundPadding() {
  const bar = 56;
  const desk = document.querySelector('.ds-recpage[data-ground] .ds-recpage__desk');
  const mast = document.querySelector('.ds-recpage[data-ground] .ds-recpage__mast');
  if (!desk || !mast) return { top: bar, bottom: 0, left: 0, right: 0 };
  const sheetLeft = desk.getBoundingClientRect().left;
  const beside = sheetLeft > window.innerWidth * 0.3;
  return beside
    ? { top: bar, bottom: 0, left: 0, right: Math.max(0, window.innerWidth - sheetLeft) }
    : {
        top: bar,
        bottom: Math.max(0, window.innerHeight - bar - (mast as HTMLElement).offsetHeight),
        left: 0,
        right: 0,
      };
}

export function RecordGround({ record, neighbors, quiet = false }: RecordGroundProps) {
  const stage = useOptionalMapStage();
  const router = useRouter();

  useEffect(() => {
    if (!stage) return;
    const [lng, lat] = record.geometry.coordinates;
    const frame = groundFrameFor(record.properties.precision, quiet);
    const edges: HistoryEdgeLineCollection = {
      type: 'FeatureCollection',
      features: neighbors.map(({ feature, relation }) => ({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [lng, lat],
            [feature.geometry.coordinates[0], feature.geometry.coordinates[1]],
          ],
        },
        properties: {
          edgeId: `${record.properties.entityId}:${feature.properties.entityId}`,
          relationshipType: relation,
          fromEntityId: record.properties.entityId,
          toEntityId: feature.properties.entityId,
          fromDisplayName: record.properties.displayName,
          toDisplayName: feature.properties.displayName,
          sentence: relation,
          coincident: false,
        },
      })),
    };
    const patch = (imagery: boolean) =>
      stage.patchData(
        nationalFieldPatch(
          { type: 'FeatureCollection', features: [record, ...neighbors.map((n) => n.feature)] },
          {
            clusteringEnabled: false,
            satellite: imagery,
            historyEdgesEnabled: edges.features.length > 0,
            historyEdgeCollection: edges,
          },
        ),
      );
    stage.applyViewState({
      selectedState: undefined,
      selectedEdge: undefined,
      selectedEntity: record.properties.entityId,
    });
    const land = (mode: 'fly' | 'cut') =>
      stage.flyPreset(
        'point',
        { center: [lng, lat], zoom: frame.zoom },
        { mode, pitch: frame.pitch, bearing: 0, padding: groundPadding() },
      );
    // Arriving cold (no plate yet) there is nowhere to fly from: the frame is a cut, landed the
    // moment the plate exists. From another surface the plate is already up and the descent is
    // the transition. Either way imagery goes on only once the frame has landed, so none is
    // fetched for the national frame or for the zooms the camera passes through.
    const cold = stage.getMap() === null;
    patch(false);
    if (!cold) land(quiet ? 'cut' : 'fly');
    let checks = 0;
    let landedCold = false;
    const timer = window.setInterval(() => {
      const map = stage.getMap();
      if (cold && !landedCold) {
        if (map) {
          land('cut');
          landedCold = true;
        }
        return;
      }
      const arrived = map !== null && Math.abs(map.getZoom() - frame.zoom) < 0.05;
      if (arrived) {
        if (frame.imagery) patch(true);
        window.clearInterval(timer);
        return;
      }
      // A flight asked of a plate that is still loading, or cut short by the plate's resize on
      // the way in, never arrives: after a few seconds at rest short of the frame, land it.
      checks += 1;
      if (checks > 150) window.clearInterval(timer);
      else if (checks % 12 === 0 && map && !map.isMoving?.()) land('cut');
    }, 200);
    return () => window.clearInterval(timer);
  }, [neighbors, quiet, record, stage]);

  /** A lit neighbor is a way to its record. */
  useEffect(
    () =>
      stage?.subscribe('select', (entityId) => {
        const neighbor = neighbors.find((n) => n.feature.properties.entityId === entityId);
        if (neighbor) router.push(neighbor.feature.properties.href);
      }),
    [neighbors, router, stage],
  );

  // Imagery is context, never evidence, and it is not a picture of the record's own time: say
  // whose it is and that its date is not the record's (design-direction-v11.md §4.2).
  return groundFrameFor(record.properties.precision, quiet).imagery ? (
    <p className="ds-recpage__imagery">
      Aerial imagery: USGS, The National Map. Its date varies by area and is not this record&apos;s
      date.
    </p>
  ) : null;
}
