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
import { WorldControls } from '../../components/shell/WorldControls';
import { shownRecords, type ShownRecord } from './shown-records';
import { RecordLink } from './record-link';
import { legText, shortPlace } from './journey';
import { loadRecordsIndex, recordsQueryCacheKey } from '../records/load-records-index';
import { FRONT_ROUTES } from './front-routes';
import {
  FRONT_CONTENTS,
  FRONT_START,
  RETELLING_CLOSING,
  RETELLING_SENTENCES,
  RETELLING_TAGLINE,
  archiveSentence,
} from './retelling-copy';
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

/** The official artwork. The wordmark is never retyped beside a symbol. */
function Lockup() {
  // eslint-disable-next-line @next/next/no-img-element -- brand artwork
  return <img src={BRAND_ASSETS.vector.lockup.dark} alt="BlackStory" width={800} height={450} />;
}

export async function Retelling({
  returning = false,
}: {
  /** On the front page a reader who has seen the opening is not shown the year count again. */
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

  // Scene 1's year: the span of decades the map's records are first documented in. The film
  // counts through it as the lights come on; without script this is what the page says.
  const decades = pins.features
    .map((pin) => pin.properties.earliestDecade)
    .filter((decade): decade is number => typeof decade === 'number');
  const firstDecade = decades.length > 0 ? Math.min(...decades) : null;
  const lastDecade = decades.length > 0 ? Math.max(...decades) : null;
  const mapped = pins.features.length.toLocaleString('en-US');

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
        <WorldControls inline />
      </nav>

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
                {scene.id === 'history' ? (
                  // The first screen is the brand's own panel: the mark as the page's title, the
                  // brand line, what the archive is and the two ways on. "History" stays this
                  // section's heading for a screen reader and the rail; the persistent word
                  // shows it as the scroll leaves this screen.
                  <h1 className="ds-scene__heading ds-scene__heading--mark">
                    <Lockup />
                  </h1>
                ) : null}
                <h2 className="ds-scene__heading" id={`${scene.id}-h`}>
                  {scene.kind === 'country' ? (
                    // The name, read once. What is seen is "Black History", set in the
                    // wordmark's own face (the site's display face) at its own spacing, closing into
                    // "BlackStory" as the scene lands: the "Hi" and the space shut and the "s"
                    // takes its capital. The typed word is then the wordmark itself, and the
                    // symbol comes in beside it where the lockup has it (front.css).
                    <>
                      <span className="ds-visually-hidden">{scene.heading}</span>
                      <span className="ds-scene__closing" aria-hidden="true">
                        <span className="ds-scene__closing-word">
                          Black
                          <span data-part="hi">
                            <span> Hi</span>
                          </span>
                          <span data-part="s">
                            <span>s</span>
                          </span>
                          <span data-part="cap">
                            <span>S</span>
                          </span>
                          tory
                        </span>
                        {/* eslint-disable-next-line @next/next/no-img-element -- brand artwork */}
                        <img
                          className="ds-scene__closing-mark"
                          src={BRAND_ASSETS.vector.symbol.dark}
                          alt=""
                        />
                      </span>
                    </>
                  ) : (
                    <SceneWord prefix={scene.prefix} heading={scene.heading} />
                  )}
                </h2>
                {scene.id === 'history' ? (
                  <>
                    <p className="ds-scene__tagline">{RETELLING_TAGLINE}</p>
                    <p className="ds-scene__sentence">{archiveSentence(total)}</p>
                    <p className="ds-scene__ways">
                      <a href={`#${RETELLING_SCENES[i + 1]!.id}`}>{FRONT_START}</a>
                      <a href="#contents">{FRONT_CONTENTS}</a>
                    </p>
                  </>
                ) : scene.kind === 'country' ? (
                  <>
                    <p className="ds-scene__tagline">{RETELLING_CLOSING}</p>
                    <p className="ds-scene__ways">
                      <Link href={FRONT_ROUTES.method}>How coverage works</Link>
                    </p>
                  </>
                ) : (
                  <p className="ds-scene__sentence">{RETELLING_SENTENCES[scene.id]}</p>
                )}
              </div>
              {scene.id === 'history' && firstDecade !== null && lastDecade !== null ? (
                <p className="ds-scene__year">
                  <span className="ds-scene__year-numeral" data-year="" aria-hidden="true">
                    {lastDecade}
                  </span>
                  <span className="ds-scene__year-caption" data-year-caption="">
                    {mapped} records on the map, first documented from the {firstDecade}s to the{' '}
                    {lastDecade}s.
                  </span>
                </p>
              ) : null}
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
                  {/* The photograph and its claim as one mounted plate: the label overlaps the
                      print the way a museum label sits on its object. */}
                  <div className="ds-scene__plate">
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
