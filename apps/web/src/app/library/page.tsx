/**
 * `/library` — the hub for everything that is not the map (SP-21, repo-92n2.29).
 *
 * The Atlas answers *where and when*; `/records` answers *which record*. Neither answers *which
 * room*, and eleven editorial rooms were reachable only by guessing at the overflow menu. This is
 * that room, and it is the second breadcrumb step for every reading and utility surface on the
 * site — which is why it had to exist before those chains could stop hanging off the Atlas.
 *
 * Every card is generated from `lib/nav/destination-registry.ts`, never hand-written, so a new
 * public route cannot be missing from here: `destination-registry.test.ts` fails first.
 *
 * Plate posture: Parked. This room never shows the map; the off-ramp hands the reader back to it.
 */
import type { Metadata } from 'next';
import React from 'react';
import { getSharedPublicEntities } from '../../lib/map-experience/shared-map-data';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { EMPTY_RECORDS_QUERY, buildRecordsIndex } from '../../lib/records/build-records-index';
import {
  GROUP_HEADINGS,
  LIBRARY_CARD_GROUPS,
  cardTitleFor,
  classLabelFor,
  destinationsInGroup,
} from '../../lib/nav/destination-registry';
import {
  CardGrid,
  GroupHeading,
  OffRamp,
  Prose,
  Room,
  RoomCard,
  RoomHeader,
} from '../../components/room';
import '../reading-room.css';

void React;

/*
 * Incrementally regenerated. This page counts its rooms from the live public catalog
 * (`getSharedPublicEntities`), so it needs a database, and it used to be `force-dynamic` because
 * App Hosting mounted DATABASE_URL at runtime only: left prerendered, the build fetched the
 * catalog, got `[public-data] postgres live catalog unavailable`, and failed the export.
 *
 * That premise no longer holds. The app is on Vercel, where DATABASE_URL is present at build, and
 * the catalog now comes from the CDN release artifact rather than a multi-MB Postgres pull.
 * Prerendering here is cheap and correct.
 *
 * The old failure mode is also no longer silent-and-wrong: `listPublicEntityViews` throws when
 * the catalog is unavailable, so a build without a database fails loudly instead of baking the
 * 4-entity Dunbar seed into production. Fail-closed at the data layer is what `force-dynamic` was
 * standing in for here.
 *
 * Cost of leaving it dynamic, measured 2026-08-09: Next sends `private, no-cache, no-store` on
 * every dynamic response, so `x-vercel-cache` was MISS on 100% of requests and every reader hit a
 * function. 3600s matches /entity/[id].
 */
export const revalidate = 3600;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/library',
  title: 'The library',
  description:
    'Every room in the archive that is not the map: chapters, law, data, banned books, the memorial, and the receipts that show how a record gets in.',
});

/**
 * The three mono facts under the title, drawn from the release rather than typed.
 *
 * Reusing `buildRecordsIndex` with an empty query rather than counting here is deliberate: the
 * library would otherwise report a record total derived one way and `/records` report one derived
 * another, and the first time they disagreed the archive would look like it was guessing.
 */
async function releaseFacts(): Promise<readonly string[]> {
  const { data: entities } = await getSharedPublicEntities();
  const model = buildRecordsIndex(entities, EMPTY_RECORDS_QUERY);

  const eras = model.facets.era.map((facet) => facet.id).sort();
  const first = eras[0];
  const last = eras[eras.length - 1];

  return [
    `${model.totalMatched.toLocaleString('en-US')} records`,
    `${model.facets.state.length} states`,
    first === undefined || last === undefined
      ? 'era not yet recorded'
      : first === last
        ? first
        : `${first} to ${last}`,
  ];
}

export default async function LibraryPage() {
  const facts = await releaseFacts();

  return (
    <Room>
      <RoomHeader
        pathname="/library"
        kicker="EVERYTHING THAT IS NOT THE MAP"
        title="The library"
        lede="The Atlas answers where and when. These rooms answer how it happened, who wrote it down, and how confident the archive is that it is true."
        meta={facts}
      />

      <Prose>
        <p>
          Every room below is built on the same records you can see on the Atlas. Prose cites
          records by name, and every citation opens the record itself, so nothing here is an
          assertion you have to take on trust. Where the archive is uncertain, it says so in the
          room rather than in a footnote.
        </p>
      </Prose>

      {LIBRARY_CARD_GROUPS.map((group) => (
        <React.Fragment key={group}>
          <GroupHeading>{GROUP_HEADINGS[group]}</GroupHeading>
          <CardGrid>
            {destinationsInGroup(group).map((destination) => (
              <RoomCard
                key={destination.path}
                href={destination.path}
                kind={destination.kind ?? ''}
                title={cardTitleFor(destination)}
                description={destination.description}
                meta={classLabelFor(destination)}
              />
            ))}
          </CardGrid>
        </React.Fragment>
      ))}

      <OffRamp
        title={
          <>
            Or go straight to the <em>record</em>
          </>
        }
        actions={[
          { label: 'Open the Atlas', href: '/', emphasis: 'copper' },
          { label: 'Read the index instead', href: '/records' },
        ]}
      >
        {/*
          The mock's third control is "Search everything ⌘K", which opens the command palette.
          It is not repeated here as a control: the palette is a client affordance, and a room
          that renders with JavaScript disabled must not end on a button that does nothing. The
          shortcut is stated instead, and both real destinations are links.
        */}
        The map places what can be placed and the index lists everything, including the records with
        no coordinates to place. Press <kbd className="ds-kbd">⌘</kbd>
        <kbd className="ds-kbd">K</kbd> to search from anywhere.
      </OffRamp>
    </Room>
  );
}
