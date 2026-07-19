/**
 * The paper-canvas beats below the persistent map hero (design-direction-v5
 * §6.1 beats 2–5): Orient ("Start with your state" — the personal-relevance
 * entry), Discover ("From the archive" story rail), the archive in numbers,
 * and one fixed-ink "How this works" band handing off to /methodology.
 *
 * Typed loosely against the featured-entity shape `app/page.tsx` already
 * builds from the public entity source so either stream can adjust its own
 * data plumbing without touching this component's contract.
 */

import Link from 'next/link';
import { KindBadge } from '../map-experience/KindBadge';
import { StateStart, type StateStartEntry } from './StateStart';

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
  /** Archive-wide figures for the numbers strip. */
  readonly recordCount: number;
  readonly stateCount: number;
  /** e.g. "1820s–1970s"; omitted when the release carries no dated records. */
  readonly eraSpan?: string | undefined;
};

/** v5 §6.5 "How this works" — three points, evidence before assertion. */
const HOW_ITEMS = [
  'Every record is documented: people, places, schools, and events with accepted claims, citations, and confidence you can read for yourself.',
  'Contradictions stay visible. When sources disagree, the record says so — confidence is never a color alone, and disputes are part of the story.',
  'Dignity is a rule, not a tone. Street-level residences stay off the public map, living people stay protected, and presence is never framed as deficit.',
] as const;

export function HomeStorySections({
  featured,
  topStates,
  recordCount,
  stateCount,
  eraSpan,
}: HomeStorySectionsProps) {
  return (
    <>
      <div className="ds-container ds-page">
        <section className="ds-section ds-section--flush" aria-labelledby="state-start-heading">
          <p className="ds-section__kicker">Near you</p>
          <h2 className="ds-section__title" id="state-start-heading">
            Start with your state.
          </h2>
          <p className="ds-section__lede">
            Every state holds documented Black history — some of it a block from somewhere you
            know. Choose yours and see what happened there.
          </p>
          <StateStart topStates={topStates} />
        </section>

        <section className="ds-section" aria-labelledby="featured-heading">
          <p className="ds-section__kicker">From the archive</p>
          <h2 className="ds-section__title" id="featured-heading">
            See what happened here.
          </h2>
          <p className="ds-section__lede">
            Select a pin on the map above, or step into a full record here.
          </p>
          <ul className="ds-story-rail">
            {featured.map((entity) => (
              <li key={entity.id}>
                <Link className="ds-story-link" href={`/entity/${entity.id}`}>
                  <span className="ds-story-link__meta">
                    <KindBadge kind={entity.kind} density="compact" />
                    <span aria-hidden="true">/</span>
                    <span>{entity.jurisdictionLabel}</span>
                  </span>
                  <h3 className="ds-story-link__title">{entity.displayName}</h3>
                  <p className="ds-story-link__summary">{entity.summary}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="ds-section" aria-label="The archive in numbers">
          <p className="ds-section__kicker">In numbers</p>
          <ul className="ds-data-strip">
            <li className="ds-data-strip__item">
              <span className="ds-data-strip__value">{recordCount}</span>
              <span className="ds-data-strip__label">Records pinned</span>
            </li>
            <li className="ds-data-strip__item">
              <span className="ds-data-strip__value">{stateCount}</span>
              <span className="ds-data-strip__label">States on the map</span>
            </li>
            {eraSpan ? (
              <li className="ds-data-strip__item">
                <span className="ds-data-strip__value">{eraSpan}</span>
                <span className="ds-data-strip__label">Eras spanned</span>
              </li>
            ) : null}
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
