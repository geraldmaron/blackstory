/**
 * The paper-canvas beats below the persistent map hero (design-direction-v5
 * §6.1): About (product thesis + quiet place orientation), From the data
 * (archive counts + `/data` census visualizations), Discover (story rail), and
 * one fixed-ink "How this works" band handing off to /methodology.
 *
 * Typed loosely against the featured-entity shape `app/(map)/page.tsx` already
 * builds from the public entity source so either stream can adjust its own
 * data plumbing without touching this component's contract.
 */

import Link from 'next/link';
import type { NationalPopulationTimelineSnapshot } from '@repo/firebase';
import { isDisplayableJurisdictionLabel } from '../../lib/public-data/map-projection';
import { KindBadge } from '../map-experience/KindBadge';
import { HomeAbout } from './HomeAbout';
import { HomeDataPulse } from './HomeDataPulse';
import type { StateStartEntry } from './StateStart';
import '../data/data-charts.css';

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
};

/** v5 §6.5 "How this works" — three points, evidence before assertion. */
const HOW_ITEMS = [
  'Every record is documented: people, places, schools, and events with accepted claims, citations, and confidence you can read for yourself.',
  'Contradictions stay visible. When sources disagree, the record says so: confidence is never a color alone, and disputes are part of the story.',
  'Dignity is a rule, not a tone. Street-level residences stay off the public map, living people stay protected, and presence is never framed as deficit.',
] as const;

export function HomeStorySections({
  featured,
  topStates,
  recordCount,
  stateCount,
  eraSpan,
  timeline,
}: HomeStorySectionsProps) {
  return (
    <>
      <div className="ds-container ds-page">
        <HomeAbout topStates={topStates} />

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

      <section className="ds-band" aria-labelledby="how-heading">
        <div className="ds-container">
          <p className="ds-section__kicker">How this works</p>
          <h2 className="ds-section__title" id="how-heading">
            Evidence before assertion.
          </h2>
          <ol className="ds-qualify-list">
            {HOW_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
          <p className="ds-band__cta">
            <Link className="ds-cta ds-cta--solid" href="/methodology">
              Read the methodology
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
