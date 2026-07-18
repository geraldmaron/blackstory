/**
 * Homepage (BB-098): the hero IS the shared `MapStage` canvas (mounted once by the `(map)`
 * layout). `HeroStage` renders the floating chrome over it per design-direction-v3.md's DOM
 * contract; `HomeStorySections` (BB-097 shell stream) owns everything below the hero — the
 * story rail into featured records, the standards band, and the methodology hand-off band.
 */
import { HomeStorySections } from '../../components/home/HomeStorySections';
import { FEATURED_SEED_IDS } from '../../data/public-seed';
import { HeroStage } from './HeroStage';
import { loadMapStageBase } from './shared-map-data';

/** Below this many released records the story rail carries the honest "early release" note —
 * a small hand-verified collection is a fact worth stating, not a defect to hide. */
const EARLY_RELEASE_THRESHOLD = 25;

export default async function HomePage() {
  const base = await loadMapStageBase();

  // Feature the curated ids when the active release carries them; otherwise lead with whatever
  // the release does hold, so the rail never goes empty just because curation lagged a release.
  const curated = FEATURED_SEED_IDS.map((id) => base.entities.find((entity) => entity.id === id)).filter(
    (entity): entity is NonNullable<typeof entity> => Boolean(entity),
  );
  const featured = curated.length > 0 ? curated : base.entities.slice(0, 3);

  return (
    <>
      <HeroStage
        featureCollection={base.featureCollection}
        jurisdictionAreaFeatures={base.jurisdictionAreaFeatures}
        featureCount={base.featureCollection.features.length}
        liveData={base.dataSource === 'live'}
      />

      <main id="main">
        <HomeStorySections
          featured={featured}
          showSeedNotice={base.dataSource !== 'live' || base.entities.length < EARLY_RELEASE_THRESHOLD}
        />
      </main>
    </>
  );
}
