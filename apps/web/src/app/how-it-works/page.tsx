/**
 * `/how-it-works` — one room for how the archive works.
 *
 * About, Methodology, Data, Law and Banned books are chapters of this document. Old index URLs
 * 308 into `?s=` section focus. Interactive law and books browse tools keep thin escape-hatch
 * routes at `/law/browse` and `/books/browse`. Lives across the decades is the Lived act of Data.
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
import { LawHubSections } from '../law/LawHubSections';
import { loadLegalCatalog } from '../../lib/legal/public-source';
import { BooksHubSections } from '../books/BooksHubSections';
import { loadBannedBooksListing } from '../../lib/banned-books/public-source.js';
import { emptyLivesAreaBundle, loadLivesAreaBundle } from '../../lib/lives/lives-source';
import { parseLivesAreaSlug } from '../../lib/lives/lives-url-state';
import { destinationById } from '../../lib/nav/destination-registry';
import { DestinationIcon } from '../../components/patterns/DestinationIcon';
import { HubSectionFocus } from './HubSectionFocus';
import './how-it-works.css';
import '../reading-room.css';
import '../about/about-page.css';
import '../../components/data/data-charts.css';
import '../data/data-page.css';

void React;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/how-it-works',
  title: 'How this archive works',
  description:
    'About BlackStory, methodology, data figures across the decades, civil-rights law, and the banned-books catalog in one room.',
});

const TOC_IDS = ['about', 'methodology', 'data', 'law', 'books'] as const;

const TOC = TOC_IDS.map((id) => {
  const destination = destinationById(id);
  if (!destination) throw new Error(`how-it-works TOC: ${id} is not in the destination catalog`);
  return { id, title: destination.label, icon: destination.icon };
});

export default async function HowItWorksPage({
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
        <HubSectionFocus />
      </Suspense>

      <ReadingEntry
        pathname="/how-it-works"
        title={
          <>
            How this <em>archive</em> works
          </>
        }
        lede="The rules, figures, statutes and catalogs behind every place, written as one document. Each chapter keeps a crawlable deep link."
        showCrumb={false}
      />

      <nav className="ds-hub-toc" aria-label="How it works chapters">
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

      <section id="about" className="ds-hub-section" aria-labelledby="hub-about-title">
        <header className="ds-hub-section__head">
          <span className="ds-hub-section__act">What this is</span>
          <GroupHeading>
            <DestinationIcon id="about" size="md" />
            <span id="hub-about-title">About</span>
          </GroupHeading>
          <Prose>
            <p>{ABOUT_LEDE}</p>
          </Prose>
        </header>
        <AboutSections />
      </section>

      <section id="methodology" className="ds-hub-section" aria-labelledby="hub-methodology-title">
        <header className="ds-hub-section__head">
          <span className="ds-hub-section__act">How a record gets in</span>
          <GroupHeading>
            <DestinationIcon id="methodology" size="md" />
            <span id="hub-methodology-title">Methodology</span>
          </GroupHeading>
          <Prose>
            <p>{METHODOLOGY_INTRO_LEDE}</p>
          </Prose>
        </header>
        <MethodologySections omitEntry />
      </section>

      <section id="data" className="ds-hub-section" aria-labelledby="hub-data-title">
        <header className="ds-hub-section__head">
          <span className="ds-hub-section__act">Presence across time</span>
          <GroupHeading>
            <DestinationIcon id="data" size="md" />
            <span id="hub-data-title">Data</span>
          </GroupHeading>
          <Prose>
            <p>{DATA_INTRO.lede}</p>
          </Prose>
        </header>
        <DataSections {...dataModel.sections} livesBundle={lives} livesAreaSlug={lives.areaSlug} />
      </section>

      <section id="law" className="ds-hub-section" aria-labelledby="hub-law-title">
        <header className="ds-hub-section__head">
          <span className="ds-hub-section__act">Statutes and rulings</span>
          <GroupHeading>
            <DestinationIcon id="law" size="md" />
            <span id="hub-law-title">Law</span>
          </GroupHeading>
        </header>
        <LawHubSections source={legalSource} />
      </section>

      <section id="books" className="ds-hub-section" aria-labelledby="hub-books-title">
        <header className="ds-hub-section__head">
          <span className="ds-hub-section__act">Challenged titles</span>
          <GroupHeading>
            <DestinationIcon id="books" size="md" />
            <span id="hub-books-title">Banned books</span>
          </GroupHeading>
        </header>
        <BooksHubSections snapshot={booksSnapshot} />
      </section>

      <DocumentColophon
        facts={[
          'How it works',
          ...dataModel.colophonFacts.slice(0, 1),
          `${legalSource.snapshots.length.toLocaleString('en-US')} law entries`,
          `${booksSnapshot.books.length.toLocaleString('en-US')} challenged titles`,
        ]}
      />

      <WalkOffRamp>
        Privacy, terms, corrections, submit, support and errata stay quiet on purpose.
      </WalkOffRamp>
    </Room>
  );
}
