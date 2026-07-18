/**
 * The three paper-canvas sections below the persistent map hero: a story
 * rail into featured records, the "what qualifies" standards band, and a
 * charcoal transparency band that hands off to /methodology.
 *
 * Typed loosely against the featured-entity shape `app/page.tsx` already
 * builds from the public entity source (kind, jurisdictionLabel,
 * displayName, summary, id) so either stream can adjust its own data
 * plumbing without touching this component's contract.
 */

import Link from 'next/link';

export type HomeStoryEntity = {
  readonly id: string;
  readonly kind: string;
  readonly jurisdictionLabel: string;
  readonly displayName: string;
  readonly summary: string;
};

export type HomeStorySectionsProps = {
  readonly featured: readonly HomeStoryEntity[];
  /** True while the public catalog is still a small early-release set. */
  readonly showSeedNotice?: boolean;
};

/** Guide p.9 "What qualifies" standards — existing copy, voice-checked. */
const QUALIFY_ITEMS = [
  'Historically relevant people, places, schools, events, institutions',
  'Documented geography at an allowed public precision',
  'Accepted claims with confidence — contradictions preserved',
  'Released projections only; research stays private until promotion',
] as const;

export function HomeStorySections({ featured, showSeedNotice = false }: HomeStorySectionsProps) {
  return (
    <>
      <div className="bp-container bp-page">
        <section className="bp-section bp-section--flush" aria-labelledby="featured-heading">
          <p className="bp-section__kicker">On the map</p>
          <h2 className="bp-section__title" id="featured-heading">
            See what happened here.
          </h2>
          <p className="bp-section__lede">
            Select a pin on the map above, or open a full record here.
          </p>
          {showSeedNotice ? (
            <p className="bp-story-rail__notice bp-mono">
              Early release — a small, hand-verified collection, not yet the full archive.
            </p>
          ) : null}
          <ul className="bp-story-rail">
            {featured.map((entity) => (
              <li key={entity.id}>
                <Link className="bp-story-link" href={`/entity/${entity.id}`}>
                  <span className="bp-story-link__meta">
                    {entity.kind} / {entity.jurisdictionLabel}
                  </span>
                  <h3 className="bp-story-link__title">{entity.displayName}</h3>
                  <p className="bp-story-link__summary">{entity.summary}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="bp-section" aria-labelledby="qualify-heading">
          <p className="bp-section__kicker">Standards</p>
          <h2 className="bp-section__title" id="qualify-heading">
            What qualifies
          </h2>
          <p className="bp-section__lede">
            Inclusion follows the product constitution — relevance, place, accepted claims,
            rights, and living-person redaction.
          </p>
          <ul className="bp-qualify-list">
            {QUALIFY_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="bp-band" aria-labelledby="method-teaser-heading">
        <div className="bp-container">
          <p className="bp-section__kicker">Transparency</p>
          <h2 className="bp-section__title" id="method-teaser-heading">
            Why a claim shows up — and how strong it is
          </h2>
          <p className="bp-section__lede">
            Confidence is never color-only. Disputes stay visible. Street-level residence stays
            off the public map.
          </p>
          <p className="bp-band__cta">
            <Link className="bp-cta bp-cta--solid" href="/methodology">
              Read methodology
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
