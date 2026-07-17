/**
 * Public home page — Gen Z news first viewport + modular story rail.
 */

import { SeedDataNotice } from '../components/SeedDataNotice';
import { FEATURED_SEED_IDS, getPublicEntity } from '../data/public-seed';

export default function HomePage() {
  const featured = FEATURED_SEED_IDS.map((id) => getPublicEntity(id)).filter(
    (entity): entity is NonNullable<typeof entity> => Boolean(entity),
  );

  return (
    <>
      <section className="bb-hero" aria-labelledby="hero-brand">
        <div className="bb-hero__inner">
          <p id="hero-brand" className="bb-hero__brand">
            Black Book
          </p>
          <h1 className="bb-hero__headline">History, pinned to place.</h1>
          <p className="bb-hero__support">
            Only records that clear the evidence bar — released, cited, and never a residential
            dossier.
          </p>
          <div className="bb-hero__actions">
            <a className="bb-cta bb-cta--solid" href="/search">
              Search now
            </a>
            <a className="bb-cta bb-cta--ghost" href="/explore">
              Explore places
            </a>
          </div>
        </div>
      </section>

      <main id="main">
        <div className="bb-container bb-page">
          <section className="bb-section bb-section--flush" aria-labelledby="featured-heading">
            <div style={{ marginBottom: 'var(--bb-space-6)' }}>
              <SeedDataNotice compact />
            </div>
            <p className="bb-section__kicker">On the board</p>
            <h2 className="bb-section__title" id="featured-heading">
              Featured sample records
            </h2>
            <p className="bb-section__lede">
              Seed fixtures for the public shell — not a live release.
            </p>
            <ul className="bb-story-rail">
              {featured.map((entity) => (
                <li key={entity.id}>
                  <a className="bb-story-link" href={`/entity/${entity.id}`}>
                    <span className="bb-story-link__meta">
                      {entity.kind} · {entity.jurisdictionLabel}
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
              Inclusion follows the product constitution — relevance, place, accepted claims, rights,
              and living-person redaction.
            </p>
            <ul className="bb-qualify-list">
              <li>Historically relevant people, places, schools, events, institutions</li>
              <li>Documented geography at an allowed public precision</li>
              <li>Accepted claims with confidence — contradictions preserved</li>
              <li>Released projections only; research stays private until promotion</li>
            </ul>
          </section>
        </div>

        <section className="bb-band" aria-labelledby="method-teaser-heading">
          <div className="bb-container">
            <p className="bb-section__kicker" style={{ color: 'var(--bb-inverse-ink)' }}>
              Transparency
            </p>
            <h2 className="bb-section__title" id="method-teaser-heading">
              Why a claim shows up — and how strong it is
            </h2>
            <p className="bb-section__lede">
              Confidence is never color-only. Disputes stay visible. Street-level residence stays
              off the public map.
            </p>
            <p style={{ marginTop: 'var(--bb-space-6)' }}>
              <a className="bb-cta bb-cta--solid" href="/methodology">
                Read methodology
              </a>
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
