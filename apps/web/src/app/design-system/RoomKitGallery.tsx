/**
 * Fixture gallery for the v9 room kit (SP-22, repo-92n2.28).
 *
 * Every block in `components/room` renders here with the design tokens it reads printed in
 * mono beside it, so a reviewer can check the kit in light and dark without opening twenty-one
 * routes. This is the fixture surface the per-screen parity gate (repo-92n2.31) checks against
 * the mock rooms in `.design-mocks/blackstory-atlas-v9.html`.
 *
 * The gallery wraps each specimen in `.ds-room` because the kit's ink and wash aliases are
 * declared there; the column width still comes from the surface class on the page root, which
 * for /design-system is Utility.
 */

import React from 'react';
import {
  Anatomy,
  Breadcrumb,
  CardGrid,
  Connections,
  DataTable,
  Disclosure,
  EmptyList,
  Field,
  GroupHeading,
  HairlineIndex,
  MapMoment,
  Note,
  OffRamp,
  Precision,
  Prose,
  RecordNav,
  RoomCard,
  RoomHeader,
  SourceList,
  TrustBlock,
  UtilityCard,
  UtilityStep,
} from '../../components/room';

void React;

/** One specimen: what it is, which tokens it reads, and the thing itself. */
function Specimen({
  name,
  tokens,
  children,
}: {
  readonly name: string;
  readonly tokens: readonly string[];
  readonly children: React.ReactNode;
}) {
  return (
    <div className="ds-room" style={{ marginTop: 'var(--ds-space-8)' }}>
      <p className="ds-mono" style={{ fontSize: '10px', letterSpacing: '0.12em' }}>
        {name.toUpperCase()}
      </p>
      <p className="ds-mono" style={{ fontSize: '10px', color: 'var(--ds-ink-subtle)' }}>
        {tokens.join(' · ')}
      </p>
      <div style={{ marginTop: 'var(--ds-space-4)' }}>{children}</div>
    </div>
  );
}

export function RoomKitGallery() {
  return (
    <section className="ds-gallery-section" aria-labelledby="room-kit-heading">
      <h2 id="room-kit-heading">Room kit (v9 surfaces)</h2>
      <p>
        The shared vocabulary for every Reading, Record and Utility room. A room renders{' '}
        <code className="ds-mono">RoomHeader</code> and nothing else as a header, and imports
        exactly one of <code className="ds-mono">reading-room.css</code>,{' '}
        <code className="ds-mono">record-page.css</code> or{' '}
        <code className="ds-mono">utility.css</code>. Design law:{' '}
        <code className="ds-mono">docs/ui/design-direction-v9-surfaces.md</code> §2 and §4.
      </p>

      <Specimen name="Breadcrumb" tokens={['--ds-accent', '--ds-ink-subtle', '--ds-font-mono']}>
        <Breadcrumb pathname="/books/the-bluest-eye" hereLabel="The Bluest Eye" />
      </Specimen>

      <Specimen
        name="RoomHeader"
        tokens={['--ds-font-display', '--ds-font-editorial', '--ds-accent', '--ds-rule']}
      >
        <RoomHeader
          pathname="/books"
          kicker="Catalogue"
          title={
            <>
              Banned <em>books</em>
            </>
          }
          lede="Every title removed from a public shelf, with the order that removed it and the district that signed it."
          meta={['1,204 titles', '1963 to 2024']}
        />
      </Specimen>

      <Specimen
        name="GroupHeading · CardGrid · RoomCard"
        tokens={['--ds-surface', '--ds-rule', '--ds-accent-graphic']}
      >
        <GroupHeading>Recently added</GroupHeading>
        <CardGrid>
          <RoomCard
            href="/design-system#room-kit-heading"
            kind="Statute"
            title="H.R. 40"
            description="A commission to study reparation proposals for African Americans."
            meta="Federal · 1989"
          />
          <RoomCard
            href="/design-system#room-kit-heading"
            kind="Dataset"
            title="Decennial population"
            description="Population and share by race, 1790 to 2020, two non-overlapping lanes."
            meta="Census Bureau · 23 series"
          />
        </CardGrid>
      </Specimen>

      <Specimen name="Prose" tokens={['--ds-font-editorial', '--ds-ink', '--ds-accent']}>
        <Prose>
          <h2>
            The ordinance and its <em>afterlife</em>
          </h2>
          <p>
            Nothing here is a summary of somebody else&apos;s article. Each chapter is built out of
            the same records the Atlas holds, which means you can leave the prose at any point and
            go look at the thing itself.
          </p>
          <ul>
            <li>The measure at 66 characters, set by the surface class.</li>
            <li>Hairline rules above every section heading.</li>
          </ul>
        </Prose>
      </Specimen>

      <Specimen name="Note · Precision" tokens={['--ds-font-mono', '--ds-border-strong']}>
        <Note kind="SERIES">
          1790 to 1990 from Gibson and Jung, Table 1. The two lanes do not overlap and are not the
          same instrument.
        </Note>
        <Precision
          resolution="county centroid"
          caveat="This is not the address of the event, and the archive does not claim one."
        />
      </Specimen>

      <Specimen
        name="TrustBlock · Anatomy"
        tokens={['--ds-surface', '--ds-rule', '--ds-ink-subtle']}
      >
        <TrustBlock
          facts={[
            { label: 'Evidence grade', value: 'B — corroborated' },
            { label: 'Sources', value: '4 primary' },
            { label: 'Last reviewed', value: 'March 2026' },
          ]}
        />
        <Anatomy
          cells={[
            { label: 'Kind', value: 'Municipal ordinance' },
            { label: 'Jurisdiction', value: 'Birmingham, AL' },
            { label: 'Enacted', value: '1926' },
            { label: 'Repealed', value: '1951' },
          ]}
        />
      </Specimen>

      <Specimen name="SourceList · Connections" tokens={['--ds-font-mono', '--ds-ink-muted']}>
        <SourceList
          sources={[
            { text: 'Library of Congress, Prints and Photographs Division', year: '1963' },
            { text: 'Birmingham Civil Rights Institute, oral history collection', year: '1998' },
            { text: 'County deed book 14' },
          ]}
        />
        <Connections
          connections={[
            {
              name: 'Birmingham, 1963',
              relation: 'same place as',
              href: '/design-system#room-kit-heading',
            },
            {
              name: 'Chapter: Redlining',
              relation: 'cited by',
              href: '/design-system#room-kit-heading',
            },
          ]}
        />
      </Specimen>

      <Specimen name="HairlineIndex" tokens={['--ds-rule', '--ds-accent', '--ds-font-mono']}>
        <HairlineIndex
          countLabel="3 of 1,204 shown"
          filters={[
            { id: 'people', label: 'People', count: 812 },
            { id: 'places', label: 'Places', count: 274 },
            { id: 'laws', label: 'Laws', count: 118 },
          ]}
          activeFilterId="people"
          rows={[
            {
              href: '/design-system#room-kit-heading',
              name: 'Isaac McGhie',
              place: 'Duluth, MN',
              era: '1920s',
              grade: '●',
            },
            {
              href: '/design-system#room-kit-heading',
              name: 'Elias Clayton',
              place: 'Duluth, MN',
              era: '1920s',
              grade: '●',
            },
            {
              href: '/design-system#room-kit-heading',
              name: 'Elmer Jackson',
              place: 'Duluth, MN',
              era: '1920s',
              grade: '○',
            },
          ]}
        />
      </Specimen>

      <Specimen name="EmptyList" tokens={['--ds-ink-muted']}>
        <EmptyList title="Nothing here yet">
          No record matches this filter. If you know of one, the archive wants it.
        </EmptyList>
      </Specimen>

      <Specimen name="DataTable" tokens={['--ds-font-mono', '--ds-border-strong', '--ds-rule']}>
        <DataTable
          caption="Population by decade"
          showCaption
          columns={[
            { key: 'decade', label: 'Decade' },
            { key: 'count', label: 'Population', numeric: true },
            { key: 'share', label: 'Share', numeric: true },
          ]}
          rows={[
            { decade: '1900s', count: '8,833,994', share: '11.6%' },
            { decade: '1950s', count: '15,042,286', share: '10.0%' },
            { decade: '2020s', count: '41,104,200', share: '12.4%' },
          ]}
        />
      </Specimen>

      <Specimen name="Disclosure · Field" tokens={['--ds-surface', '--ds-accent-graphic']}>
        <Disclosure summary="How this figure was derived">
          <Prose>
            <p>Counts come from the decennial summary files, not from the working paper.</p>
          </Prose>
        </Disclosure>
        <Field label="Your email" htmlFor="gallery-email">
          <input id="gallery-email" type="email" placeholder="you@example.org" />
        </Field>
      </Specimen>

      <Specimen name="UtilityCard · UtilityStep" tokens={['--ds-surface', '--ds-accent-graphic']}>
        <UtilityCard title="What happens next">
          <p>Moderation details stay restricted. This is what you can see.</p>
          <UtilityStep index={1} title="Received" detail="12 MARCH 2026 · 09:12 UTC" done />
          <UtilityStep index={2} title="In review" detail="ASSIGNED TO AN EDITOR" />
          <UtilityStep index={3} title="Published or declined" detail="YOU WILL BE EMAILED" />
        </UtilityCard>
      </Specimen>

      <Specimen
        name="OffRamp · RecordNav"
        tokens={['--ds-surface', '--ds-elevation-sm', '--ds-rule']}
      >
        <OffRamp
          title="No reading room is a dead end"
          actions={[
            {
              href: '/design-system#room-kit-heading',
              label: 'Browse the records',
              emphasis: 'copper',
            },
            { href: '/design-system#room-kit-heading', label: 'How this was built' },
          ]}
        >
          Every room ends by naming somewhere else worth going. This block is mandatory at the foot
          of a reading room.
        </OffRamp>
        <RecordNav
          previous={{ href: '/design-system#room-kit-heading', label: 'Elias Clayton' }}
          next={{ href: '/design-system#room-kit-heading', label: 'Elmer Jackson' }}
        />
      </Specimen>

      <Specimen
        name="MapMoment"
        tokens={['--room-sunk', '--ds-accent-graphic', '--ds-radius-md', '--ds-rule']}
      >
        {/* Inside a stage, so both states are inspectable: scroll one of these past the halfway
            mark and it takes the plate — copper edge, tag, and the Atlas hand-off appear, while
            the other returns to idle. Exactly one is ever live, which is the rule /law,
            /methodology and chapter detail depend on.

            NO STAGE IS MOUNTED HERE. `SiteShell` now mounts one for the whole document (SP-08),
            and a second stage nested inside it would shadow the first for every moment below it:
            the moments would register with the inner stage while the plate — which subscribes
            once, from above — listened to the outer one, so nothing would ever borrow the plate.
            One stage per document is the contract.

            These two specimens therefore demonstrate arbitration, not the borrow. /design-system
            is a Utility surface and `framedClaimAllowed` refuses a claim there on purpose, so the
            plate stays parked however visible these slots are. The borrow itself is shown on a
            Reading or Record surface. */}
        <MapMoment
          camera={{ center: [-87.635, 41.901], zoom: 12.8, pitch: 36, bearing: -12 }}
          note="Chicago's Black Belt, 1919. The camera flies in because the subject is a neighbourhood, not a killing."
          atlasHref="/?find=place"
        />
        <MapMoment
          plain
          camera={{ center: [-92.1005, 46.7867], zoom: 12 }}
          note="Duluth, Minnesota, held at locality precision. The camera cuts here and does not move."
        />
      </Specimen>
    </section>
  );
}
