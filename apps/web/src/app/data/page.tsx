/**
 * `/data`: the reference ledger. Census counts, a door into Lives, and published indicator
 * series, with a sticky contents list on desktop. Every figure names the series behind it.
 *
 * Primary arrivals (Rooms, footer, bare `/data`) must paint at the top. Deep links into the
 * Lived act use `/data#lives`. Legacy `?s=lives` hops once to the immersive `/lives` room.
 */
import type { Metadata } from 'next';
import React from 'react';
import { permanentRedirect } from 'next/navigation';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import Link from 'next/link';
import { PageHeader } from '@repo/ui';
import { parentCrumb, Room } from '../../components/room';
import { TrustMast } from '../../components/trust';
import {
  buildLivesHref,
  parseLivesAreaSlug,
  parseLivesSearchParams,
  type RawLivesSearchParams,
} from '../../lib/lives/lives-url-state';
import { DATA_INTRO, DATA_PAGE_DESCRIPTION } from './data-copy';
import { DataSections, millionsFigure } from './DataSections';
import { loadDataPageModel } from './load-data-page-model';
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

  const latest = dataModel.sections.timelineRows.at(-1);

  return (
    <Room
      width="wide"
      className="ds-trust-room"
      masthead={
        <TrustMast
          tone="copper"
          numeral={
            latest === undefined
              ? undefined
              : {
                  // The figure the population chart's finding states ("41.3 million in 2020"), with
                  // the census category the chart's table scopes it to.
                  value: `${millionsFigure(latest.blackPopulation)}M`,
                  label: `${latest.raceCategoryLabel}, counted in ${latest.decade}`,
                }
          }
        >
          <PageHeader
            display
            crumb={parentCrumb('/data')}
            linkAs={Link}
            title="What the numbers show, and what they leave out"
            dek={DATA_INTRO.lede}
          />
        </TrustMast>
      }
    >
      <DataSections {...dataModel.sections} />
    </Room>
  );
}
