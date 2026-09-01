/**
 * `/` is the door: brand first, then the national pin field, then ways into the archive.
 *
 * The mast keeps ABOUT_LINE and ABOUT_WALK_PAST (do not rewrite). The plate is the existing
 * HTML pin plate, not MapLibre. The Atlas instrument stays on `/explore`.
 *
 * Cost: builds first-paint pins from the map source directly — no Atlas shell / facet / graph
 * work on the Door request path.
 */
import React from 'react';
import Link from 'next/link';
import { listPublicEntities } from '../data/public-seed';
import { getSharedPublicEntities } from '../lib/map-experience/shared-map-data';
import { buildExploreMapSource } from '../lib/map-experience/build-explore-map-source';
import { isFirstPaintWalk, toFirstPaintPins } from '../lib/map-experience/first-paint-pins';
import { ABOUT_LINE, ABOUT_WALK_PAST } from './about/about-copy';
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
  const { data: entities } = await loadDoorEntities();
  const pins = toFirstPaintPins(buildExploreMapSource(entities).featureCollection.features);
  const stands = pins.features.filter(isFirstPaintWalk).slice(0, 6);

  return (
    <main id="main" className="ds-door">
      <div className="ds-door__stage">
        <section className="ds-door__frame" aria-labelledby="door-brand">
          <p className="ds-door__eyebrow">Place-connected archive</p>
          <h1 id="door-brand" className="ds-door__brand">
            BlackStory
          </h1>
          <p className="ds-door__support">History, pinned to place.</p>
          <p id="door-line" className="ds-door__line">
            {ABOUT_LINE}
          </p>
          <p className="ds-door__walk">{ABOUT_WALK_PAST}</p>

          <nav className="ds-door__ways" aria-label="Ways into the archive">
            <Link className="ds-cta ds-cta--copper" href="/explore">
              Open the Atlas
            </Link>
            <Link className="ds-cta ds-cta--ink" href="/records">
              Browse records
            </Link>
            <Link className="ds-cta ds-cta--quiet" href="/library">
              Library
            </Link>
          </nav>

          {stands.length > 0 ? (
            <nav className="ds-door__stands" aria-label="Places you can walk into">
              <p className="ds-door__stands-label">Walk into a place</p>
              <ul className="ds-door__stands-list">
                {stands.map((feature) => (
                  <li key={feature.properties.entityId}>
                    <Link href={feature.properties.href}>{feature.properties.displayName}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </section>

        <div className="ds-door__field">
          <div className="ds-door__ground" aria-hidden="true" />
          <FirstPaintPinPlate pins={pins} />
        </div>
      </div>
    </main>
  );
}
