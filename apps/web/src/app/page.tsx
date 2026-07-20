/**
 * Public home page interactive US map teaser that enters the Explore premier experience.
 */

import { US_CONUS_BOUNDS } from '@repo/domain/map/geography';
import { FEATURED_SEED_IDS, getPublicEntity } from '../data/public-seed';
import { listPublicEntityViews } from '../lib/public-data/source';
import { HomeMapHero } from './HomeMapHero';
import { buildExploreViewModel } from './explore/explore-view-model';
import { buildExploreMapStyle } from './map/explore-style';

export default async function HomePage() {
  const entities = await listPublicEntityViews();
  const explore = buildExploreViewModel({}, entities.data, entities.source);
  const featureCollection = {
    type: 'FeatureCollection' as const,
    features: [...explore.filteredFeatures],
  };
  const mapStyle = buildExploreMapStyle({
    featureCollection,
    jurisdictionAreaFeatures: explore.source.jurisdictionAreaFeatures,
    densityLayerEnabled: false,
  });
  // Seed fixtures are D.C.-local bias east so circular pins sit clear of the left hero copy.
  const initialViewport = {
    lat: 38.9072,
    lng: -76.9,
    zoom: 5.2,
  } as const;

  const featured = FEATURED_SEED_IDS.map((id) => getPublicEntity(id)).filter(
    (entity): entity is NonNullable<typeof entity> => Boolean(entity),
  );

  return (
    <>
      <HomeMapHero
        mapStyle={mapStyle}
        featureCollection={featureCollection}
        bounds={US_CONUS_BOUNDS}
        densityLevels={explore.densityLevels}
        initialViewport={initialViewport}
        showSeedNotice={explore.dataSource !== 'live'}
        featureCount={explore.filteredFeatures.length}
      />

      <main id="main">
        <div className="bb-container bb-page">
          <section className="bb-section bb-section--flush" aria-labelledby="featured-heading">
            <p className="bb-section__kicker">On the map</p>
            <h2 className="bb-section__title" id="featured-heading">
              Featured sample records
            </h2>
            <p className="bb-section__lede">
              Seed fixtures for the public shell — select a pin on the map above, or open a full
              record here.
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
