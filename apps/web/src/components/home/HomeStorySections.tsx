/**
 * The paper-canvas beats below the persistent map hero (design-direction-v5
 * §6.1): About (product thesis + quiet place orientation), From the data
 * (archive counts + `/data` census visualizations), Discover (story rail), and
 * How this works (theme-aware methodology sketch + three trust points).
 *
 * Chart and pipeline-sketch CSS are imported by `app/(map)/page.tsx` so this
 * module stays unit-testable under node/tsx without CSS loaders.
 */

import React from 'react';
import Link from 'next/link';
import type { NationalPopulationTimelineSnapshot } from '@repo/firebase';
import { isDisplayableJurisdictionLabel } from '../../lib/public-data/map-projection';
import { KindBadge } from '../map-experience/KindBadge';
import { HomeAbout, type HomeAboutProps } from './HomeAbout';
import { HomeDataPulse } from './HomeDataPulse';
import { HomeHowThisWorks } from './HomeHowThisWorks';
import type { StateStartEntry } from './StateStart';

void React;

export type HomeStoryEntity = {
  readonly id: string;
  readonly kind: string;
  readonly jurisdictionLabel: string;
  readonly displayName: string;
  readonly summary: string;
};

export type HomeStorySectionsProps = {
  readonly featured: readonly HomeStoryEntity[];
  /** States with pinned records, ordered by record count descending (top slice). */
  readonly topStates: readonly StateStartEntry[];
  /** Archive-wide figures for the data pulse. */
  readonly recordCount: number;
  readonly stateCount: number;
  /** e.g. "1820s–1970s"; omitted when the release carries no dated records. */
  readonly eraSpan?: string | undefined;
  /** Merged 1790–2020 national timeline snapshot for the data pulse. */
  readonly timeline?: NationalPopulationTimelineSnapshot | undefined;
  /** Override for tests — defaults to the live StateStart client control. */
  readonly OrientControl?: HomeAboutProps['OrientControl'];
};

export function HomeStorySections({
  featured,
  topStates,
  recordCount,
  stateCount,
  eraSpan,
  timeline,
  OrientControl,
}: HomeStorySectionsProps) {
  return (
    <>
      <div className="ds-container ds-page">
        <HomeAbout
          topStates={topStates}
          {...(OrientControl ? { OrientControl } : {})}
        />

        <HomeDataPulse
          recordCount={recordCount}
          stateCount={stateCount}
          eraSpan={eraSpan}
          timeline={timeline}
        />

        <section className="ds-section" aria-labelledby="featured-heading">
          <p className="ds-section__kicker">From the archive</p>
          <h2 className="ds-section__title" id="featured-heading">
            See what happened here.
          </h2>
          <p className="ds-section__lede">
            Select a pin on the map above, or step into a full record here.
          </p>
          <ul className="ds-story-rail">
            {featured.map((entity) => {
              const jurisdiction = isDisplayableJurisdictionLabel(entity.jurisdictionLabel)
                ? entity.jurisdictionLabel.trim()
                : undefined;
              return (
                <li key={entity.id}>
                  <Link className="ds-story-link" href={`/entity/${entity.id}`}>
                    <span className="ds-story-link__meta">
                      <KindBadge kind={entity.kind} density="compact" />
                      {jurisdiction ? (
                        <>
                          <span aria-hidden="true">/</span>
                          <span>{jurisdiction}</span>
                        </>
                      ) : null}
                    </span>
                    <h3 className="ds-story-link__title">{entity.displayName}</h3>
                    <p className="ds-story-link__summary">{entity.summary}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <HomeHowThisWorks />
    </>
  );
}
