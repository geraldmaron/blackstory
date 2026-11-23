/**
 * `/`: the home page (docs/ui/archive/design-direction-v12.md, "On the Ground").
 *
 * A page of ordinary sections over the persistent map, in reading order: the title (what this
 * is, in one sentence, with real photographs and the lead story), the journey (a few records,
 * oldest first, the map traveling between them), the country (every light, and what a light
 * means), the stories, and how a record is graded. Complete as HTML without JavaScript; the film
 * (home-film.tsx) is an enhancement that pins each stop and moves the camera with the scroll.
 */
import React from 'react';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { buttonClassName } from '@repo/ui';
import { loadDoorPinPlate } from '../../lib/map-experience/door-catalog';
import { resolveDoorFocusPinId } from '../../lib/map-experience/first-paint-pins';
import { getSharedPublicEntities } from '../../lib/map-experience/shared-map-data';
import { precisionInWords } from '../../lib/map-experience/geo-precision';
import { confidenceIconFor } from '../../lib/map-experience/confidence-icons';
import { confidenceTierPhrase } from '../../lib/evidence/confidence-language';
import { listPublicStoryListItems } from '../../lib/stories/source';
import { RecordImage } from '../../components/entity/RecordImage';
import { EvidenceList } from '../../components/evidence/EvidenceList';
import { coverDek } from '../../components/story/story-text';
import { doorRecords, type DoorRecord } from '../door-decade-walk';
import { gradeCounts } from '../door-chapters';
import { DoorRecordLink } from '../door-record-link';
import { loadRecordsIndex, recordsQueryCacheKey } from '../records/load-records-index';
import { buildStoriesFront } from '../stories/stories-index';
import { CoverImage } from '../stories/StoriesIndexParts';
import { HomeFilm, type HomeFilmStop } from './home-film';
import { legText, pickJourney, pickTitlePlates, shortPlace } from './home-journey';
import './home.css';

void React;

const COUNT_WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six'] as const;

/** A record as the page shows it: its public href and its pin on the plate. */
type Shown = DoorRecord & { readonly pinId: string | null };

export async function HomePage() {
  const [{ pins, features, densityLevels }, { data: entities }] = await Promise.all([
    loadDoorPinPlate(),
    getSharedPublicEntities(),
  ]);
  const [{ model }, stories] = await Promise.all([
    loadRecordsIndex(recordsQueryCacheKey({})),
    listPublicStoryListItems().catch(() => ({ items: [] as const })),
  ]);

  const hrefByPin = new Map(
    pins.features.map((pin) => [pin.properties.entityId, pin.properties.href] as const),
  );
  const shown = (record: DoorRecord): Shown => {
    const pinId = resolveDoorFocusPinId(record.entityId, features);
    return { ...record, pinId, href: (pinId ? hrefByPin.get(pinId) : undefined) || record.href };
  };

  const records = doorRecords(features, entities);
  const journey = pickJourney(records).map(shown);
  const journeyIds = new Set(journey.map((record) => record.entityId));
  const plates = pickTitlePlates(records, journeyIds, 4).map(shown);

  const front = stories.items.length > 0 ? buildStoriesFront(stories.items) : null;
  const lead = front?.lead;
  // Chapters only: the list also carries president entries, which are not long stories.
  const moreStories = front?.covers ?? [];

  const total = model.totalAll.toLocaleString('en-US');
  const lights = pins.features.length.toLocaleString('en-US');
  const stops: HomeFilmStop[] = journey.map((record, i) => ({
    id: `home-stop-${i + 1}`,
    pinId: record.pinId,
    lngLat: record.lngLat,
    precision: record.precision,
    decade: record.decade,
    label: record.locality ?? record.name,
    name: record.name,
    href: record.href,
    leg:
      i + 1 < journey.length
        ? {
            text: legText(record.lngLat, journey[i + 1]!.lngLat),
            to: shortPlace(journey[i + 1]!.locality ?? journey[i + 1]!.name),
          }
        : null,
  }));
  const countWord = COUNT_WORDS[journey.length] ?? String(journey.length);

  return (
    <main id="main" className="ds-home" data-ground="ink" data-ground-fixed="">
      <HomeFilm pins={pins} densityLevels={densityLevels} stops={stops} />

      {/* —— Title ————————————————————————————————————————————————————————————— */}
      <section className="ds-home-title" aria-labelledby="home-title">
        <div className="ds-home-title__words">
          <h1 className="ds-home-title__headline" id="home-title">
            Black history happened <em>here.</em>
          </h1>
          <p className="ds-home-title__line">
            BlackStory is an archive of {total} sourced records of Black history in the United
            States, each pinned to the place it happened.
          </p>
          <form className="ds-home-title__search" action="/search" role="search">
            <label className="ds-visually-hidden" htmlFor="home-search">
              Search the archive
            </label>
            <input
              id="home-search"
              name="q"
              type="search"
              placeholder="Search a town, a name, a year"
              autoComplete="off"
            />
            <button type="submit" className={buttonClassName('primary')}>
              Search
            </button>
          </form>
          <p className="ds-home-title__ways">
            {lead ? (
              <Link className="ds-home-title__way" href={`/stories/${lead.slug}`}>
                Read the story, {lead.title}
              </Link>
            ) : null}
            <Link className="ds-home-title__way" href="/explore">
              Open the map
            </Link>
          </p>
          <p className="ds-home-title__coverage">
            The lights behind this page are records published so far. Dark places aren’t researched
            yet. <Link href="/methodology">How coverage works</Link>
          </p>
        </div>

        {/* Real photographs of real records, each a link to its record, credit beside it. The
            lead story's own document is the largest. Chosen by rule (home-journey.ts). */}
        <ul className="ds-home-title__plates" aria-label="Records in the archive">
          {lead?.heroImage ? (
            <li className="ds-home-plate ds-home-plate--lead" data-depth="1">
              <Link href={`/stories/${lead.slug}`} className="ds-home-plate__link">
                <CoverImage item={lead} width={900} eager className="ds-home-plate__img" />
                <span className="ds-home-plate__label">
                  <span className="ds-home-plate__kicker">Story · {lead.eraLabel}</span>
                  {lead.title}
                </span>
              </Link>
              <p className="ds-home-plate__credit">{lead.heroImage.credit}</p>
            </li>
          ) : null}
          {plates.map((record, i) => (
            <li key={record.entityId} className="ds-home-plate" data-depth={(i % 3) + 1}>
              <RecordImage
                entityId={record.pinId ?? record.entityId}
                entityName={record.name}
                image={record.plate!}
                width={520}
                className="ds-home-plate__figure"
              />
              <DoorRecordLink className="ds-home-plate__name" href={record.href}>
                {record.name}
                {record.locality ? (
                  <span className="ds-home-plate__place">{record.locality}</span>
                ) : null}
              </DoorRecordLink>
            </li>
          ))}
        </ul>

        {journey.length > 0 ? (
          <a className="ds-home-title__cue" href="#home-stop-1">
            Scroll to visit {countWord} records, oldest first
          </a>
        ) : null}
      </section>

      {/* —— Journey ——————————————————————————————————————————————————————————— */}
      {journey.length > 0 ? (
        <section className="ds-home-journey" aria-labelledby="home-journey">
          <h2 className="ds-visually-hidden" id="home-journey">
            {countWord.charAt(0).toUpperCase()}
            {countWord.slice(1)} records from the archive, oldest first
          </h2>
          <ol className="ds-home-journey__stops">
            {journey.map((record, i) => {
              const stop = stops[i]!;
              return (
                <li key={stop.id} className="ds-home-stop">
                  <section
                    className="ds-home-stop__section"
                    id={stop.id}
                    aria-labelledby={`${stop.id}-name`}
                    data-tour-step={i}
                  >
                    <div className="ds-home-stop__scene">
                      {/* The decade the archive first documents this record in, at the height
                          of the scene. Said in words in the kicker; this is the same fact. */}
                      <p className="ds-home-stop__year" aria-hidden="true">
                        {record.decade}s
                      </p>
                      <div className="ds-home-stop__plate">
                        <RecordImage
                          entityId={record.pinId ?? stop.id}
                          entityName={record.name}
                          image={record.plate!}
                          width={900}
                          className={`ds-home-stop__figure${record.person ? ' ds-home-stop__figure--upper' : ''}`}
                        />
                        {/* The archive does not store when a photograph was taken. Most are
                            recent pictures of a place, so the page says so beside each one. */}
                        <p className="ds-home-stop__photo-note">
                          The photograph’s date is not on record. It may be recent.
                        </p>
                      </div>
                      <div className="ds-home-stop__words">
                        <p className="ds-home-stop__kicker">
                          {i + 1} of {journey.length} · First documented in the {record.decade}s
                        </p>
                        <h3 className="ds-home-stop__name" id={`${stop.id}-name`}>
                          {record.name}
                        </h3>
                        <p className="ds-home-stop__place">
                          {record.locality ? `${record.locality}. ` : ''}
                          {precisionInWords(record.precision)}.
                        </p>
                        <div className="ds-home-slip" data-ground="paper" data-ground-fixed="">
                          <EvidenceList items={[{ ...record.claim, id: `${stop.id}-claim` }]} />
                        </div>
                        <DoorRecordLink
                          className={buttonClassName('primary', 'ds-home-stop__open')}
                          href={record.href}
                        >
                          Open the record
                          <span className="ds-visually-hidden">, {record.name}</span>
                        </DoorRecordLink>
                      </div>
                    </div>
                  </section>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {/* —— Country ——————————————————————————————————————————————————————————— */}
      <section className="ds-home-country" id="home-country" aria-labelledby="home-country-h">
        <div className="ds-home-country__words">
          <h2 className="ds-home-country__headline" id="home-country-h">
            {lights} lights so far.
          </h2>
          <p className="ds-home-country__line">
            Each one is a published record with its sources. Dark ground means nobody’s gotten there
            yet, not that nothing happened there. Alaska, Hawaii and a few records abroad may sit
            outside this frame.
          </p>
          <p className="ds-home-country__ways">
            <Link className={buttonClassName('primary')} href="/explore">
              Open the map
            </Link>
            <Link className={buttonClassName('secondary')} href="/records">
              Browse all {total} records
            </Link>
          </p>
        </div>
      </section>

      {/* —— Stories and receipts: one paper sheet rising over the map ———————————— */}
      <div className="ds-home-sheet" data-ground="paper" data-ground-fixed="">
        {lead ? (
          <section className="ds-home-stories" aria-labelledby="home-stories-h">
            <p className="ds-home-sheet__kicker">The long stories</p>
            <article className="ds-home-story ds-home-story--lead">
              {/* Only the lead story's cover is shown here. Other covers can be harm imagery
                  (a massacre postcard), which never goes on the home page; they stay text. */}
              {lead.heroImage ? (
                <figure className="ds-home-story__cover">
                  <Link href={`/stories/${lead.slug}`} tabIndex={-1} aria-hidden="true">
                    <CoverImage item={lead} width={1400} className="ds-home-story__img" />
                  </Link>
                  <figcaption>{lead.heroImage.credit}</figcaption>
                </figure>
              ) : null}
              <div className="ds-home-story__text">
                <p className="ds-home-story__era">{lead.eraLabel}</p>
                <h2 className="ds-home-story__title" id="home-stories-h">
                  <Link href={`/stories/${lead.slug}`}>{lead.title}</Link>
                </h2>
                <p className="ds-home-story__dek">{coverDek(lead.summary)}</p>
                <Link className={buttonClassName('primary')} href={`/stories/${lead.slug}`}>
                  Read the story
                </Link>
              </div>
            </article>
            {moreStories.length > 0 ? (
              <ul className="ds-home-stories__more">
                {moreStories.map((story) => (
                  <li key={story.slug} className="ds-home-story ds-home-story--row">
                    <p className="ds-home-story__era">{story.eraLabel}</p>
                    <h3 className="ds-home-story__title">
                      <Link href={`/stories/${story.slug}`}>{story.title}</Link>
                    </h3>
                    <p className="ds-home-story__dek">{coverDek(story.summary)}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        <section className="ds-home-receipts" aria-labelledby="home-receipts-h">
          <p className="ds-home-sheet__kicker">The receipts</p>
          <h2 className="ds-home-receipts__headline" id="home-receipts-h">
            Every record carries its grade.
          </h2>
          <p className="ds-home-receipts__line">
            A grade says how well the sources hold a record up: how many independent publishers
            stand behind it, and how directly they say it.
          </p>
          <ul className="ds-home-receipts__grades">
            {gradeCounts(model.facets.evidence).map(({ level, count }) => (
              <li key={level} className={`ds-home-receipts__grade ds-grade-tag--${level}`}>
                <span className="ds-home-receipts__count">{count.toLocaleString('en-US')}</span>
                <span className="ds-home-receipts__label">
                  <FontAwesomeIcon
                    icon={confidenceIconFor(level)}
                    className="ds-grade-tag__glyph"
                    aria-hidden="true"
                  />
                  {confidenceTierPhrase(level)}
                </span>
              </li>
            ))}
          </ul>
          <Link className="ds-home-receipts__link" href="/methodology">
            How a record is graded
          </Link>
        </section>
      </div>
    </main>
  );
}
