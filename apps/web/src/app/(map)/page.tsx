/**
 * Homepage (BB-098): the hero IS the shared `MapStage` canvas (mounted once by the `(map)`
 * layout). `HeroStage` renders the floating chrome over it per design-direction-v3.md's DOM
 * contract. Below the hero: featured records, "what qualifies," and the methodology band.
 *
 * Gap note (see this stream's final report): design-direction-v3.md assigns the "below the
 * hero" story-rail/standards/methodology bands to `components/home/HomeStorySections.tsx`, owned
 * by the shell stream. That component had not landed as of this pass, so the sections below are
 * the pre-existing homepage content (unchanged in substance from the pre-BB-098 `page.tsx`),
 * kept rather than deleted so the homepage still has a working, non-empty body. Swap this block
 * for `<HomeStorySections />` once that component ships.
 */
import { getPublicEntity, FEATURED_SEED_IDS } from '../../data/public-seed';
import { SeedDataNotice } from '../../components/SeedDataNotice';
import { HeroStage } from './HeroStage';
import { loadMapStageBase } from './shared-map-data';

export default async function HomePage() {
  const base = await loadMapStageBase();

  const featured = FEATURED_SEED_IDS.map((id) => getPublicEntity(id)).filter(
    (entity): entity is NonNullable<typeof entity> => Boolean(entity),
  );

  return (
    <>
      <HeroStage
        featureCollection={base.featureCollection}
        jurisdictionAreaFeatures={base.jurisdictionAreaFeatures}
        featureCount={base.featureCollection.features.length}
        liveData={base.dataSource === 'live'}
      />

      <main id="main">
        <div className="bb-container bb-page">
          {base.dataSource !== 'live' ? <SeedDataNotice compact /> : null}

          <section className="bb-section bb-section--flush" aria-labelledby="featured-heading">
            <p className="bb-section__kicker">On the map</p>
            <h2 className="bb-section__title" id="featured-heading">
              See what happened here
            </h2>
            <p className="bb-section__lede">
              Documented records from the active release — select a pin on the map above, or open
              a full record here.
            </p>
            <ul className="bb-story-rail">
              {featured.map((entity) => (
                <li key={entity.id}>
                  <a className="bb-story-link" href={`/entity/${entity.id}`}>
                    <span className="bb-story-link__meta">
                      {entity.kind} &middot; {entity.jurisdictionLabel}
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
