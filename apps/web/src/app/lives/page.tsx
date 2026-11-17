/** `/lives`: one life question across time, using only publishable and cited comparisons. */
import type { Metadata } from 'next';
import React from 'react';
import { LIVES_NATIONAL } from '@repo/domain/statistics/lives';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { PageHeader } from '@repo/ui';
import Link from 'next/link';
import { parentCrumb, Room } from '../../components/room';
import { TrustMast, TrustSheet } from '../../components/trust';
import { livesDecadeNumeral } from '../../components/lives/lives-mast';
import { emptyLivesAreaBundle, loadLivesAreaView } from '../../lib/lives/lives-source';
import type { RawLivesSearchParams } from '../../lib/lives/lives-url-state';
import { parseLivesMilestone } from '../../lib/lives/lives-milestones';
import { LivesSourceNotice } from '../../components/lives/LivesSourceNotice';
import { LivesMilestoneExperience } from '../../components/lives/LivesMilestoneExperience';
import { resolveStoryCollection } from '../../lib/stories/source';
import {
  livesNarrativeSeriesId,
  mapLivesNarrativesToEras,
  renumberLivesNarrativeReferences,
} from '../../lib/lives/lives-narratives';
import '../../components/story/story.css';
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
  const loaded = await loadLivesAreaView(LIVES_NATIONAL.slug);
  const bundle = loaded?.bundle ?? emptyLivesAreaBundle(LIVES_NATIONAL);
  const mapping = mapLivesNarrativesToEras(
    await resolveStoryCollection(livesNarrativeSeriesId(milestone.key)),
  );
  for (const problem of mapping.problems) console.warn(`[lives] narrative: ${problem}`);
  const narratives = renumberLivesNarrativeReferences(mapping.byEraId);

  return (
    <Room
      width="wide"
      className="ds-trust-room"
      masthead={
        <TrustMast tone="sand" numeral={livesDecadeNumeral(bundle)} art={['tools', 'grain']}>
          <PageHeader
            display
            crumb={parentCrumb('/lives')}
            linkAs={Link}
            title="Lives across the decades"
            dek="One ordinary question, followed through the census, the rules in force and the words of the people who lived it."
          />
        </TrustMast>
      }
    >
      <TrustSheet>
        <LivesSourceNotice
          source={loaded?.source ?? 'unreadable'}
          areaName={bundle.areaName}
          retryHref="/lives"
        />
        <LivesMilestoneExperience bundle={bundle} milestone={milestone} narratives={narratives} />
      </TrustSheet>
    </Room>
  );
}
