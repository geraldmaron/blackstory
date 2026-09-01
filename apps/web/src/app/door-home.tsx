/**
 * `/` is the Door Immersive Journey: scroll chapters zoom the national pin field.
 *
 * Chapter order, rotating facts, and the evidence spotlight are rolled once per request
 * (same pickers as Atlas StoryMode) so visits vary without loading MapLibre. Pins with
 * public hrefs are clickable. Atlas instrument stays on `/explore`.
 */
import React from 'react';
import { loadDoorPinPlate } from '../lib/map-experience/door-catalog';
import { pickStoryChapters } from '../lib/story/pick-story-chapters';
import { pickStoryRecord } from '../lib/story/pick-story-record';
import { DoorImmersive } from './door-immersive';
import './door-home.css';

void React;

export async function DoorHome() {
  const { pins, features } = await loadDoorPinPlate();
  const placeCount = pins.features.length.toLocaleString('en-US');

  const orderRoll = Math.random();
  const recordRoll = Math.random();
  const { chapters, factByChapterId } = pickStoryChapters(orderRoll);
  const spotlight = pickStoryRecord(features, recordRoll);
  const spotlightFeature = spotlight
    ? features.find((feature) => feature.properties.entityId === spotlight.entityId)
    : undefined;
  const spotlightLngLat = spotlightFeature
    ? ([
        spotlightFeature.geometry.coordinates[0],
        spotlightFeature.geometry.coordinates[1],
      ] as const)
    : null;

  return (
    <main id="main" className="ds-door">
      <DoorImmersive
        pins={pins}
        catalogFeatures={features}
        chapters={chapters}
        factByChapterId={factByChapterId}
        spotlight={spotlight}
        spotlightLngLat={spotlightLngLat}
        placeCount={placeCount}
      />
    </main>
  );
}
