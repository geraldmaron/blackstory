/**
 * `/` is the door: the locked about mast, then the plate of pins.
 *
 * The mast is ABOUT_LINE. ABOUT_WALK_PAST is the existing origin paragraph, not a
 * second lede. Do not retype either. The plate is the existing HTML pin plate.
 * The Atlas instrument stays on `/explore`.
 */
import React from 'react';
import { listPublicEntities } from '../data/public-seed';
import { getSharedPublicEntities } from '../lib/map-experience/shared-map-data';
import { toFirstPaintPins } from '../lib/map-experience/first-paint-pins';
import { ABOUT_LINE, ABOUT_WALK_PAST } from './about/about-copy';
import { buildAtlasShell } from './explore/explore-view-model';
import { FirstPaintPinPlate } from './first-paint-pin-plate';
import './door-home.css';

void React;

async function loadDoorEntities() {
  try {
    return await getSharedPublicEntities();
  } catch {
    return { data: listPublicEntities(), source: 'none' as const };
  }
}

export async function DoorHome() {
  const { data: entities, source: dataSource } = await loadDoorEntities();
  const { noscriptFeatures } = buildAtlasShell({}, entities, dataSource);
  const pins = toFirstPaintPins(noscriptFeatures);

  return (
    <main id="main" className="ds-door">
      <section className="ds-door__frame" aria-labelledby="door-line">
        <h1 id="door-line" className="ds-door__line">
          {ABOUT_LINE}
        </h1>
        <p className="ds-door__walk">{ABOUT_WALK_PAST}</p>
      </section>
      <FirstPaintPinPlate pins={pins} />
    </main>
  );
}
