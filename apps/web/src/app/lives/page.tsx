/** `/lives`: one life question across time, using only publishable and cited comparisons. */
import type { Metadata } from 'next';
import React from 'react';
import { LIVES_NATIONAL } from '@repo/domain/statistics/lives';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { DocumentColophon, ReadingEntry, Room } from '../../components/room';
import { WalkOffRamp } from '../walk-off-ramp';
import { emptyLivesAreaBundle, loadLivesAreaBundle } from '../../lib/lives/lives-source';
import type { RawLivesSearchParams } from '../../lib/lives/lives-url-state';
import {
  buildLivesMilestonePanels,
  livesMilestoneSpanLabel,
  parseLivesMilestone,
} from '../../lib/lives/lives-milestones';
import { LivesMilestoneExperience } from '../../components/lives/LivesMilestoneExperience';
import { resolveArticleSeries } from '../../lib/articles/source';
import {
  livesNarrativeSeriesId,
  mapLivesNarrativesToEras,
  renumberLivesNarrativeReferences,
} from '../../lib/lives/lives-narratives';
import '../../components/article/article.css';
import '../reading-room.css';
import './lives.css';

void React;

const DESCRIPTION =
  'How published counts described Black, white and Hispanic lives across regions and decades, with sourced voices, places, laws, and the limits of the record.';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/lives',
  title: 'Lives across the decades',
  description: DESCRIPTION,
});

export default async function LivesIndexPage({
  searchParams,
}: {
  readonly searchParams: Promise<RawLivesSearchParams>;
}) {
  const raw = await searchParams;
  const milestone = parseLivesMilestone(raw.milestone);
  const loaded = await loadLivesAreaBundle(LIVES_NATIONAL.slug);
  const bundle = loaded ?? emptyLivesAreaBundle(LIVES_NATIONAL);
  const mapping = mapLivesNarrativesToEras(
    await resolveArticleSeries(livesNarrativeSeriesId(milestone.key)),
  );
  for (const problem of mapping.problems) console.warn(`[lives] narrative: ${problem}`);
  const narratives = renumberLivesNarrativeReferences(mapping.byEraId);

  return (
    <Room>
      <ReadingEntry
        pathname="/lives"
        title="Lives across the decades"
        lede="Follow one ordinary question through changing counts, rules, and accounts of lived experience. Every visible figure is sourced."
        showCrumb={false}
      />
      <DocumentColophon
        facts={[
          'United States',
          livesMilestoneSpanLabel(buildLivesMilestonePanels(bundle, milestone, narratives)) ??
            '1870s to 2020s',
          'Published comparisons only',
        ]}
      />

      <LivesMilestoneExperience bundle={bundle} milestone={milestone} narratives={narratives} />

      <WalkOffRamp>
        Every figure names its table. Rules sit beside the numbers, not as their cause. Method on{' '}
        <a href="/methodology#lives-across-decades">Methodology</a>. Compact census spine on{' '}
        <a href="/data#lives">Data</a>.
      </WalkOffRamp>
    </Room>
  );
}
