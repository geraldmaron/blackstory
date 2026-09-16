/**
 * `/apparatus` — one room for how the archive works.
 *
 * About, Methodology, Data, Law and Banned books are sections of this document. Old index URLs
 * 308 into `?s=` section focus. Interactive law and books browse tools keep thin escape-hatch
 * routes at `/law/browse` and `/books/browse`. Lives across the decades is a Data subsection.
 */
import type { Metadata } from 'next';
import React, { Suspense } from 'react';
import { LIVES_NATIONAL, livesAreaBySlug } from '@repo/domain/statistics/lives';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { DocumentColophon, GroupHeading, Prose, ReadingEntry, Room } from '../../components/room';
import { WalkOffRamp } from '../walk-off-ramp';
import { AboutSections } from '../about/AboutSections';
import { MethodologySections } from '../methodology/MethodologySections';
import { ABOUT_LEDE } from '../about/about-copy';
import { METHODOLOGY_INTRO_LEDE } from '../methodology/methodology-copy';
import { DATA_INTRO } from '../data/data-copy';
import { DataSections } from '../data/DataSections';
import { loadDataPageModel } from '../data/load-data-page-model';
import { LawApparatusSections } from '../law/LawApparatusSections';
import { loadLegalCatalog } from '../../lib/legal/public-source';
import { BooksApparatusSections } from '../books/BooksApparatusSections';
import { loadBannedBooksListing } from '../../lib/banned-books/public-source.js';
import { emptyLivesAreaBundle, loadLivesAreaBundle } from '../../lib/lives/lives-source';
import { parseLivesAreaSlug } from '../../lib/lives/lives-url-state';
import { destinationById } from '../../lib/nav/destination-registry';
import { DestinationIcon } from '../../components/patterns/DestinationIcon';
import { ApparatusSectionFocus } from './ApparatusSectionFocus';
import './apparatus.css';
import '../reading-room.css';
import '../about/about-page.css';
import '../../components/data/data-charts.css';
import '../data/data-page.css';

void React;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/apparatus',
  title: 'How this archive works',
  description:
    'About BlackStory, methodology, data figures, civil-rights law, and the banned-books catalog in one apparatus room.',
});

const TOC_IDS = ['about', 'methodology', 'data', 'law', 'books'] as const;

const TOC = TOC_IDS.map((id) => {
  const destination = destinationById(id);
  if (!destination) throw new Error(`apparatus TOC: ${id} is not in the destination catalog`);
  return { id, title: destination.label, icon: destination.icon };
});

export default async function ApparatusPage({
  searchParams,
}: {
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}) {
  const raw = await searchParams;
  const livesAreaSlug = parseLivesAreaSlug(raw);
  const [dataModel, legalSource, booksSnapshot, livesBundle] = await Promise.all([
    loadDataPageModel(),
    loadLegalCatalog(),
    loadBannedBooksListing(),
    loadLivesAreaBundle(livesAreaSlug),
  ]);
  const lives =
    livesBundle ?? emptyLivesAreaBundle(livesAreaBySlug(livesAreaSlug) ?? LIVES_NATIONAL);

  return (
    <Room>
      <Suspense fallback={null}>
        <ApparatusSectionFocus />
      </Suspense>

      <ReadingEntry
        pathname="/apparatus"
        title={
          <>
            How this <em>archive</em> works
          </>
        }
        lede="One apparatus room for the rules, figures, statutes and catalogs that sit behind every place. Sections keep crawlable deep links."
        showCrumb={false}
      />

      <nav className="ds-apparatus-toc" aria-label="Apparatus sections">
        <ul>
          {TOC.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`}>
                <DestinationIcon id={section.icon} />
                {section.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <section id="about" className="ds-apparatus-section" aria-labelledby="apparatus-about-title">
        <GroupHeading>
          <DestinationIcon id="about" size="md" />
          <span id="apparatus-about-title">About</span>
        </GroupHeading>
        <Prose>
          <p>{ABOUT_LEDE}</p>
        </Prose>
        <AboutSections />
      </section>

      <section
        id="methodology"
        className="ds-apparatus-section"
        aria-labelledby="apparatus-methodology-title"
      >
        <GroupHeading>
          <DestinationIcon id="methodology" size="md" />
          <span id="apparatus-methodology-title">Methodology</span>
        </GroupHeading>
        <Prose>
          <p>{METHODOLOGY_INTRO_LEDE}</p>
        </Prose>
        <MethodologySections omitEntry />
      </section>

      <section id="data" className="ds-apparatus-section" aria-labelledby="apparatus-data-title">
        <GroupHeading>
          <DestinationIcon id="data" size="md" />
          <span id="apparatus-data-title">Data</span>
        </GroupHeading>
        <Prose>
          <p>{DATA_INTRO.lede}</p>
        </Prose>
        <DataSections {...dataModel.sections} livesBundle={lives} livesAreaSlug={lives.areaSlug} />
      </section>

      <section id="law" className="ds-apparatus-section" aria-labelledby="apparatus-law-title">
        <GroupHeading>
          <DestinationIcon id="law" size="md" />
          <span id="apparatus-law-title">Law</span>
        </GroupHeading>
        <LawApparatusSections source={legalSource} />
      </section>

      <section id="books" className="ds-apparatus-section" aria-labelledby="apparatus-books-title">
        <GroupHeading>
          <DestinationIcon id="books" size="md" />
          <span id="apparatus-books-title">Banned books</span>
        </GroupHeading>
        <BooksApparatusSections snapshot={booksSnapshot} />
      </section>

      <DocumentColophon
        facts={[
          'Apparatus',
          ...dataModel.colophonFacts.slice(0, 1),
          `${legalSource.snapshots.length.toLocaleString('en-US')} law entries`,
          `${booksSnapshot.books.length.toLocaleString('en-US')} challenged titles`,
        ]}
      />

      <WalkOffRamp>
        Privacy, terms, corrections, submit, support, locate and errata stay quiet on purpose.
      </WalkOffRamp>
    </Room>
  );
}
