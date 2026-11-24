/**
 * `/data`: census counts, a link into Lives, and published indicator series, with a sticky
 * contents list on desktop. Every figure names the series behind it and has its own page at
 * `/data/[figure]`.
 *
 * A bare `/data` paints at the top. `/data#lives` is the Lives section. Legacy `?s=lives` hops once
 * to `/lives`.
 */
import type { Metadata } from 'next';
import React from 'react';
import { permanentRedirect } from 'next/navigation';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import Link from 'next/link';
import { PageHeader } from '@repo/ui';
import { parentCrumb, PageFrame } from '../../components/page';
import { TrustMast } from '../../components/trust';
import {
  buildLivesHref,
  parseLivesAreaSlug,
  parseLivesSearchParams,
  type RawLivesSearchParams,
} from '../../lib/lives/lives-url-state';
import { DATA_INTRO, DATA_PAGE_DESCRIPTION } from './data-copy';
import { DataSections } from './DataSections';
import { loadDataPageModel } from './load-data-page-model';
import { parseFigureViews } from '../../components/data/figures/registry';
import '../reading-page.css';
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

  const model = await loadDataPageModel();
  const latest = model.latestCensus;

  return (
    <PageFrame
      width="wide"
      className="ds-trust-doc"
      masthead={
        <TrustMast
          numeral={
            latest === undefined
              ? undefined
              : {
                  // The count figure D-03's finding states ("41.3 million in 2020"), with the
                  // census category its table scopes it to. `TrustMast` sets it as a sentence.
                  value: `${(latest.blackPopulation / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 1 })}M`,
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
      <DataSections
        figures={model.figures}
        populationAsOf={model.populationAsOf}
        indicatorsAsOf={model.indicatorsAsOf}
        views={parseFigureViews(raw.view)}
      />
    </PageFrame>
  );
}
