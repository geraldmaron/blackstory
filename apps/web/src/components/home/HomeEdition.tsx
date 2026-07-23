/**
 * Homepage scroll beats orchestrator (mockup v8.2): five dense institutional beats below
 * the hero, on Archive Paper family surfaces with edition index headers.
 *
 * Chart, edition, and pipeline-sketch CSS are imported by `app/(map)/page.tsx` so this module
 * stays unit-testable under node/tsx without CSS loaders.
 */

import React from 'react';
import type { NationalPopulationTimelineSnapshot } from '@repo/domain/statistics/public-data-summaries';
import { HomeAbout, type HomeAboutProps } from './HomeAbout';
import { HomeAtlasRewind } from './HomeAtlasRewind';
import { HomeDataPulse } from './HomeDataPulse';
import { HomeFeaturedRecord } from './HomeFeaturedRecord';
import { HomeHowThisWorks } from './HomeHowThisWorks';
import type { HomeFeaturedEntity } from './home-entity-facts';
import type { StateStartEntry } from './StateStart';

void React;

export type { HomeFeaturedEntity as HomeStoryEntity } from './home-entity-facts';
export type { StateStartEntry } from './StateStart';

export type HomeEditionProps = {
  readonly featured: readonly HomeFeaturedEntity[];
  readonly featuredInitialIndex?: number;
  readonly topStates: readonly StateStartEntry[];
  /** Full published entity catalog count for the active release. */
  readonly publishedRecordCount: number;
  /** Geo-anchored map feature count (may be lower when records lack a public pin). */
  readonly pinnedRecordCount: number;
  readonly stateCount: number;
  readonly eraSpan?: string | undefined;
  readonly timeline?: NationalPopulationTimelineSnapshot | undefined;
  readonly OrientControl?: HomeAboutProps['OrientControl'];
};

export function HomeEdition({
  featured,
  featuredInitialIndex,
  topStates,
  publishedRecordCount,
  pinnedRecordCount,
  stateCount,
  eraSpan,
  timeline,
  OrientControl,
}: HomeEditionProps) {
  return (
    <main id="main" className="ds-home-edition" data-home-edition="v6">
      <HomeAbout
        topStates={topStates}
        {...(OrientControl ? { OrientControl } : {})}
      />
      <HomeFeaturedRecord
        featured={featured}
        {...(featuredInitialIndex !== undefined ? { initialIndex: featuredInitialIndex } : {})}
      />
      <HomeDataPulse
        publishedRecordCount={publishedRecordCount}
        pinnedRecordCount={pinnedRecordCount}
        stateCount={stateCount}
        {...(eraSpan !== undefined ? { eraSpan } : {})}
        {...(timeline !== undefined ? { timeline } : {})}
      />
      <HomeHowThisWorks />
      <HomeAtlasRewind />
    </main>
  );
}
