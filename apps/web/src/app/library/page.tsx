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
  destinationsInGroup,
} from '../../lib/nav/destination-registry';
import { CardGrid, GroupHeading, OffRamp, Room, RoomCard, RoomHeader } from '../../components/room';
import '../reading-room.css';

void React;

/*
 * Must stay dynamic. This page counts its rooms from the live public catalog
 * (`getSharedPublicEntities`), so rendering it requires a database. Left prerendered, the build
 * fetches the catalog, gets `[public-data] postgres live catalog unavailable`, and fails the
 * whole export on /library.
 *
 * Tried and reverted on 2026-08-10: switched to `export const revalidate` to make the route
 * CDN-cacheable, on the reasoning that the original constraint was Firebase App Hosting mounting
 * DATABASE_URL at runtime only, and that Vercel has it at build. Vercel does. THE CI BUILD DOES
 * NOT. The `Build and Typecheck` job builds without database secrets, so ISR here fails the
 * required gate:
 *
 *   Error occurred prerendering page "/library"
 *   Error: [public-data] postgres live catalog unavailable
 *   Export encountered an error on /library/page: /library, exiting the build.
 *
 * The constraint is therefore about any database-less build, not about one hosting platform, and
 * it does not expire. /entity/[id] escapes it only because its generateStaticParams returns [],
 * so nothing is prerendered and the catalog is never read at build. There is no equivalent escape
 * for a route with no dynamic segment: `revalidate` means prerender at build.
 *
 * The cost of staying dynamic is real and known: Next sends `private, no-cache, no-store` on every
 * dynamic response, so this route is a CDN miss on every request. Making it cacheable needs the
 * page to stop requiring the catalog at render, or the build to have a database. Both are bigger
 * changes than a route-segment-config flip.
 */
export const dynamic = 'force-dynamic';

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

/**
 * The registry stores kinds in the v6 mono-caps register (`LONG FORM`, `CATALOGUE`). The rows
 * print them as a quiet right-hand tag, where caps would shout across every row, so they are
 * cased here rather than rewritten in the registry — the mobile app and the palette still read
 * the same field.
 */
function sentenceCase(kind: string): string {
  return kind.charAt(0) + kind.slice(1).toLowerCase();
}

export default async function LibraryPage() {
  const facts = await releaseFacts();

  return (
    <Room>
      <RoomHeader
        pathname="/library"
        kicker="Everything that is not the map"
        title="The library"
        lede="The Atlas answers where and when. These rooms answer how it happened, who wrote it down, and how confident the archive is that it is true."
        meta={facts}
        showPath={false}
      />

      {/*
        No standing paragraph between the lede and the rooms. A hub's job is to answer "which
        room", and the sentence that used to sit here — that every room is built on the same
        records and cites them by name — is the claim /methodology exists to make in full. Here
        it was a wall between a reader and the eleven links they came for.
      */}
      {LIBRARY_CARD_GROUPS.map((group) => (
        <React.Fragment key={group}>
          <GroupHeading>{GROUP_HEADINGS[group]}</GroupHeading>
          {/* Rows, not the three-up grid: five destinations across three columns read as a card
              wall, and the reader is choosing a room, not scanning a catalogue of like things. */}
          <CardGrid layout="rows">
            {destinationsInGroup(group).map((destination) => (
              <RoomCard
                key={destination.path}
                href={destination.path}
                kind={destination.kind ?? ''}
                title={cardTitleFor(destination)}
                description={destination.description}
                {...(destination.kind ? { tag: sentenceCase(destination.kind) } : {})}
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
          { label: 'The index', href: '/records' },
        ]}
      >
        {/*
          The mock's third control is "Search everything ⌘K", which opens the command palette.
          It is not repeated here as a control: the palette is a client affordance, and a room
          that renders with JavaScript disabled must not end on a button that does nothing. The
          shortcut is stated instead, and both real destinations are links.
        */}
        Press <kbd className="ds-kbd">⌘</kbd>
        <kbd className="ds-kbd">K</kbd> to search from anywhere.
      </OffRamp>
    </Room>
  );
}
