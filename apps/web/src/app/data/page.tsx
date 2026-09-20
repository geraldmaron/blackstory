/**
 * `/data`: the reference ledger. Census counts, a compact door into Lives, and published
 * indicator series. Every figure names the series behind it.
 *
 * Primary arrivals (Rooms, footer, bare `/data`) must paint at the top. Deep links into the
 * Lived act use `/data#lives`. Legacy `?s=lives` hops once to the immersive `/lives` room.
 */
import type { Metadata } from 'next';
import React from 'react';
import { permanentRedirect } from 'next/navigation';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { DocumentColophon, ReadingEntry, Room } from '../../components/room';
import { WalkOffRamp } from '../walk-off-ramp';
import {
  buildLivesHref,
  parseLivesAreaSlug,
  parseLivesSearchParams,
  type RawLivesSearchParams,
} from '../../lib/lives/lives-url-state';
import { DATA_INTRO, DATA_PAGE_DESCRIPTION } from './data-copy';
import { DataSections } from './DataSections';
import { loadDataPageModel } from './load-data-page-model';
import '../../components/data/data-charts.css';
import '../reading-room.css';
import './data-page.css';

void React;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/data',
  title: 'Data',
  description: DATA_PAGE_DESCRIPTION,
});

function firstValue(raw: string | readonly string[] | undefined): string | undefined {
  if (raw === undefined) return undefined;
  return typeof raw === 'string' ? raw : raw[0];
}

export default async function DataPage({
  searchParams,
}: {
  readonly searchParams: Promise<RawLivesSearchParams>;
}) {
  const raw = await searchParams;
  // Retired hub/deep-link flag. Hash is the web-native section target; do not auto-scroll via JS.
  if ((firstValue(raw.s) ?? '').trim().toLowerCase() === 'lives') {
    permanentRedirect(buildLivesHref(parseLivesAreaSlug(raw), parseLivesSearchParams(raw)));
  }

  const dataModel = await loadDataPageModel();

  return (
    <Room ledger>
      <ReadingEntry
        pathname="/data"
        title={
          <>
            What the numbers <em>show</em>, and what they leave out.
          </>
        }
        lede={DATA_INTRO.lede}
      />
      <DocumentColophon facts={dataModel.colophonFacts} />

      <DataSections {...dataModel.sections} />

      <WalkOffRamp>
        Every series here is published by the agency named beneath its figure.
      </WalkOffRamp>
    </Room>
  );
}
