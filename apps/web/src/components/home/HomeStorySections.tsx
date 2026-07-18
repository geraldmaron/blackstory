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
      <div className="bb-container bb-page">
        <section className="bb-section bb-section--flush" aria-labelledby="featured-heading">
          <p className="bb-section__kicker">On the map</p>
          <h2 className="bb-section__title" id="featured-heading">
            See what happened here.
          </h2>
          <p className="bb-section__lede">
            Select a pin on the map above, or open a full record here.
          </p>
          {showSeedNotice ? (
            <p className="bb-story-rail__notice bb-mono">
              Early release — a small, hand-verified collection, not yet the full archive.
            </p>
          ) : null}
          <ul className="bb-story-rail">
            {featured.map((entity) => (
              <li key={entity.id}>
                <a className="bb-story-link" href={`/entity/${entity.id}`}>
                  <span className="bb-story-link__meta">
                    {entity.kind} / {entity.jurisdictionLabel}
                  </span>
                  <h3 className="bb-story-link__title">{entity.displayName}</h3>
                  <p className="bb-story-link__summary">{entity.summary}</p>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="bb-section" aria-labelledby="qualify-heading">
          <p className="bb-section__kicker">Standards</p>
          <h2 className="bb-section__title" id="qualify-heading">
            What qualifies
          </h2>
          <p className="bb-section__lede">
            Inclusion follows the product constitution — relevance, place, accepted claims,
            rights, and living-person redaction.
          </p>
          <ul className="bb-qualify-list">
            {QUALIFY_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="bb-band" aria-labelledby="method-teaser-heading">
        <div className="bb-container">
          <p className="bb-section__kicker">Transparency</p>
          <h2 className="bb-section__title" id="method-teaser-heading">
            Why a claim shows up — and how strong it is
          </h2>
          <p className="bb-section__lede">
            Confidence is never color-only. Disputes stay visible. Street-level residence stays
            off the public map.
          </p>
          <p className="bb-band__cta">
            <a className="bb-cta bb-cta--solid" href="/methodology">
              Read methodology
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
