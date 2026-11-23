/**
 * The retelling (docs/ui/DESIGN.md section 9.7): History, His story, Her story, Your story,
 * Their story, BlackStory, as six sections on the ink ground over the persistent map.
 *
 * This file is the whole content, in order, as server HTML: six real sections with real
 * headings, the three records as exhibits with their slips, the town field, the wordmark and the
 * archive's one sentence. It reads without JavaScript and under reduced motion as it is written
 * here. On a wide screen with motion allowed, front.css pins each section and shows one
 * persistent word whose italic prefix changes while "story" holds still, and `RetellingFilm`
 * moves the map's camera with the scroll. Nothing is timed and nothing captures the wheel.
 *
 * What a scene may say: its word, one sentence on what the word means (retelling-copy.ts), and
 * for a record its own published name, place, photograph and one sourced claim. The line between
 * two scenes states only distance and direction. No scene says its record led to the next.
 */
import React from 'react';
import Link from 'next/link';
import { BRAND_ASSETS } from '@repo/config';
import { loadDoorPinPlate } from '../../lib/map-experience/door-catalog';
import { resolveDoorFocusPinId } from '../../lib/map-experience/first-paint-pins';
import { getSharedPublicEntities } from '../../lib/map-experience/shared-map-data';
import { precisionInWords } from '../../lib/map-experience/geo-precision';
import { RecordImage } from '../../components/entity/RecordImage';
import { EvidenceList } from '../../components/evidence/EvidenceList';
import { shownRecords, type ShownRecord } from './shown-records';
import { RecordLink } from './record-link';
import { legText, shortPlace } from './journey';
import { loadRecordsIndex, recordsQueryCacheKey } from '../records/load-records-index';
import { FRONT_ROUTES } from './front-routes';
import { RETELLING_SENTENCES, RETELLING_TAGLINE, archiveSentence } from './retelling-copy';
import { RetellingFilm, type RetellingStop } from './retelling-film';
import { RETELLING_PICKS, pickedRecord } from './retelling-picks';
import { RETELLING_SCENES, isRecordScene, type RetellingSceneId } from './retelling-scenes';
import { TownField } from './town-field';
import './front.css';

void React;

/** A record as the scene shows it: its public href and its pin on the map. */
type Shown = ShownRecord & { readonly pinId: string | null };

const placeOf = (record: ShownRecord) => shortPlace(record.locality ?? record.name);

/** The scene's word as its heading: the changing word in italic, "story" plain. */
function SceneWord({ prefix, heading }: { readonly prefix: string; readonly heading: string }) {
  return prefix ? (
    <>
      <em>{prefix}</em> story
    </>
  ) : (
    <>{heading}</>
  );
}

export async function Retelling({
  returning = false,
}: {
  /** On the front page a reader who has seen the opening lands on the last scene. */
  readonly returning?: boolean;
}) {
  const [{ pins, features, densityLevels }, { data: entities }, { model }] = await Promise.all([
    loadDoorPinPlate(),
    getSharedPublicEntities(),
    loadRecordsIndex(recordsQueryCacheKey({})),
  ]);
  const hrefByPin = new Map(
    pins.features.map((pin) => [pin.properties.entityId, pin.properties.href] as const),
  );
  const records = shownRecords(features, entities);
  const shownFor = (id: RetellingSceneId): Shown | null => {
    if (!isRecordScene(id)) return null;
    const record = pickedRecord(records, RETELLING_PICKS[id]);
    if (!record) return null;
    const pinId = resolveDoorFocusPinId(record.entityId, features);
    return { ...record, pinId, href: (pinId ? hrefByPin.get(pinId) : undefined) || record.href };
  };
  const shown = RETELLING_SCENES.map((scene) => shownFor(scene.id));

  // Where the camera is going as each scene arrives: distance and direction, nothing else.
  let last: Shown | null = null;
  const legs = RETELLING_SCENES.map((scene, i) => {
    const record = shown[i];
    if (scene.kind === 'word') return null;
    if (!record) {
      last = null;
      return 'Up to the whole country';
    }
    const leg = last
      ? `${legText(last.lngLat, record.lngLat)} to ${placeOf(record)}`
      : `Down to ${placeOf(record)}`;
    last = record;
    return leg;
  });

  const stops: (RetellingStop | null)[] = shown.map((record) =>
    record
      ? {
          pinId: record.pinId,
          lngLat: record.lngLat,
          precision: record.precision,
          place: placeOf(record),
        }
      : null,
  );
  const total = model.totalAll.toLocaleString('en-US');

  return (
    <RetellingFilm
      pins={pins}
      densityLevels={densityLevels}
      stops={stops}
      sceneIds={RETELLING_SCENES.map((scene) => scene.id)}
      returning={returning}
    >
      {/* The persistent word, shown only where scenes pin (front.css). Decorative: every
          section below carries the same word as its real heading. The invisible first line
          holds the widest word's width, so "tory" never moves while the rest changes. */}
      <div className="ds-retelling__stage" aria-hidden="true">
        <p className="ds-retelling__word">
          <span className="ds-retelling__sizer">
            <em>Their</em> story
          </span>
          <span className="ds-retelling__row">
            <span className="ds-retelling__prefixes">
              {/* "His" twice: plain inside History, then italic once the word splits. */}
              <span data-for="history">
                <span>His</span>
              </span>
              {RETELLING_SCENES.filter((scene) => scene.prefix).map((scene) => (
                <span key={scene.id} data-for={scene.id}>
                  {scene.id === 'black-story' ? (
                    <span>{scene.prefix}</span>
                  ) : (
                    <em>{scene.prefix}</em>
                  )}
                </span>
              ))}
            </span>
            <span className="ds-retelling__gap">
              <span> </span>
            </span>
            <span className="ds-retelling__s">
              <span>s</span>
            </span>
            <span className="ds-retelling__cap">
              <span>S</span>
            </span>
            tory
          </span>
        </p>
      </div>

      <nav className="ds-retelling__rail" aria-label="The opening, word by word">
        <ol>
          {RETELLING_SCENES.map((scene) => (
            <li key={scene.id}>
              <a href={`#${scene.id}`} data-rail={scene.id}>
                {scene.heading}
              </a>
            </li>
          ))}
        </ol>
        <Link className="ds-retelling__skip" href={FRONT_ROUTES.archive} data-skip="">
          Skip to the archive
        </Link>
      </nav>

      <h1 className="ds-retelling__title">BlackStory</h1>

      {RETELLING_SCENES.map((scene, i) => {
        const record = shown[i];
        const leg = legs[i];
        return (
          <section
            key={scene.id}
            className="ds-scene"
            id={scene.id}
            data-scene={scene.id}
            data-kind={scene.kind}
            aria-labelledby={`${scene.id}-h`}
            style={{ '--scene-screens': scene.screens } as React.CSSProperties}
          >
            {leg ? (
              <p className="ds-scene__leg" data-leg={scene.id}>
                {leg}
              </p>
            ) : null}
            <div className="ds-scene__pin">
              <div className="ds-scene__words">
                {scene.kind === 'country' ? (
                  <h2 className="ds-scene__heading ds-scene__heading--mark" id={`${scene.id}-h`}>
                    {/* The official artwork. The wordmark is never retyped beside a symbol. */}
                    {/* eslint-disable-next-line @next/next/no-img-element -- brand artwork */}
                    <img src={BRAND_ASSETS.lockup.dark} alt="BlackStory" width={800} height={450} />
                  </h2>
                ) : (
                  <h2 className="ds-scene__heading" id={`${scene.id}-h`}>
                    <SceneWord prefix={scene.prefix} heading={scene.heading} />
                  </h2>
                )}
                {scene.kind === 'country' ? (
                  <>
                    <p className="ds-scene__tagline">{RETELLING_TAGLINE}</p>
                    <p className="ds-scene__sentence">{archiveSentence(total)}</p>
                    <p className="ds-scene__ways">
                      <Link href={FRONT_ROUTES.method}>How coverage works</Link>
                      <a href="#history" data-watch="" hidden>
                        Watch the opening
                      </a>
                    </p>
                  </>
                ) : (
                  <p className="ds-scene__sentence">{RETELLING_SENTENCES[scene.id]}</p>
                )}
              </div>
              {record ? (
                <>
                  <p className="ds-scene__record">
                    <RecordLink className="ds-scene__name" href={record.href}>
                      {record.name}
                    </RecordLink>
                    <span className="ds-scene__place">
                      {record.locality ? `${record.locality}. ` : ''}
                      {precisionInWords(record.precision)}.
                    </span>
                  </p>
                  <RecordImage
                    entityId={record.pinId ?? record.entityId}
                    entityName={record.name}
                    image={record.plate!}
                    width={720}
                    className="ds-scene__exhibit"
                  />
                  <div className="ds-scene__slip" data-ground="paper" data-ground-fixed="">
                    <EvidenceList items={[{ ...record.claim, id: `${scene.id}-claim` }]} />
                  </div>
                </>
              ) : null}
              {scene.kind === 'town' ? (
                <TownField pins={pins} nextSceneId="their-story" nextStop={stops[i + 1] ?? null} />
              ) : null}
            </div>
          </section>
        );
      })}
    </RetellingFilm>
  );
}
