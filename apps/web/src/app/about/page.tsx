/**
 * `/about`: what this is, who made it, and how to take part. The records-by-state figure reads
 * the State facet of the released register, so it agrees with `/records`.
 */
import type { Metadata } from 'next';
import React from 'react';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import Link from 'next/link';
import { PageHeader } from '@repo/ui';
import { parentCrumb, Room } from '../../components/room';
import { TrustMast } from '../../components/trust';
import { loadRecordsIndex, recordsQueryCacheKey } from '../records/load-records-index';
import { ABOUT_LEDE } from './about-copy';
import { AboutSections, type AboutSectionsProps } from './AboutSections';
import '../reading-room.css';
import '../../components/trust/trust.css';
import './about-page.css';

void React;

export const revalidate = 3600;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/about',
  title: 'About',
  description:
    'BlackStory is a place-connected Black history archive, built by one person so documented history stays findable, and kept open so other people can add to it.',
});

/** The figure is an addition, so a catalog outage drops it rather than the page. */
async function loadStates(): Promise<AboutSectionsProps['states']> {
  try {
    const { model } = await loadRecordsIndex(recordsQueryCacheKey({}));
    return {
      total: model.totalAll,
      counts: model.facets.state.map((facet) => ({
        postal: facet.id,
        name: facet.label,
        count: facet.count,
      })),
    };
  } catch {
    return undefined;
  }
}

export default async function AboutPage() {
  const states = await loadStates();
  return (
    <Room
      width="wide"
      className="ds-trust-room ds-about-room"
      masthead={
        <TrustMast
          tone="copper"
          numeral={
            states === undefined
              ? undefined
              : {
                  value: states.total.toLocaleString('en-US'),
                  label: 'published records, each pinned where its sources put it',
                }
          }
        >
          <PageHeader
            display
            crumb={parentCrumb('/about')}
            linkAs={Link}
            title="Doing my part, and making room for yours."
            dek={ABOUT_LEDE}
          />
        </TrustMast>
      }
    >
      <AboutSections {...(states === undefined ? {} : { states })} />
    </Room>
  );
}
