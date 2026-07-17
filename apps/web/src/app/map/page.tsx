/**
 * BB-070 map data platform demo route.
 *
 * This is a fixture-level integration, not the full national map experience
 * (BB-051, a separate still-blocked bead) — it exists to prove the data
 * platform (packages/domain/src/map) and a real MapLibre GL JS component
 * work end to end against the same seed-data path the rest of the app uses
 * (src/data/public-seed.ts). The GeoJSON below was generated once by
 * packages/domain/src/map/generate-demo-map-source.ts, which wires
 * @black-book/domain's buildMapSource to the REAL redaction function from
 * @black-book/security — see that script and docs/adr/ADR-013-map-stack.md
 * for how this stands in for the release-activation build this bead does
 * not wire live.
 */
import { MapExplorer } from '@black-book/ui';
import { US_BOUNDS, US_STATES } from '@black-book/domain';
import { SeedDataNotice } from '../../components/SeedDataNotice';
import { MapLibreCanvas } from './MapLibreCanvas';
import { buildDarkArchiveStyle } from './dark-archive-style';
import mapSource from './map-source.seed.json';

export const metadata = {
  title: 'Map',
  description: 'BB-070 map data platform demo — every geo-anchored seed record at public precision.',
};

export default function MapPage() {
  const features = mapSource.featureCollection.features.map((feature) => ({
    id: feature.id,
    displayName: feature.properties.displayName,
    kind: feature.properties.kind,
    precision: feature.properties.precision,
    ...(feature.properties.statePostalCode
      ? { statePostalCode: feature.properties.statePostalCode }
      : {}),
  }));

  const style = buildDarkArchiveStyle(mapSource.featureCollection, US_STATES);

  return (
    <main className="bb-container bb-page" id="main">
      <p className="bb-page__eyebrow">Data platform</p>
      <h1 className="bb-page__title">Map (BB-070 demo)</h1>
      <p className="bb-page__lede">
        Every geo-anchored seed record, redacted through the same public-projection pipeline the
        rest of the site uses, rendered on a real MapLibre GL JS map with a custom dark,
        desaturated basemap. This is the data platform underneath BB-051&rsquo;s full national map
        experience, not that experience itself.
      </p>

      <div className="bb-stack" style={{ marginTop: 'var(--bb-space-6)' }}>
        <SeedDataNotice />

        <MapExplorer
          title="Everything-active seed population"
          caption="Public precision only — living-person locations are coarsened to city level or coarser; state outlines below are approximate bounding boxes, not administrative boundaries (see ADR-013)."
          features={features}
          stateAggregates={mapSource.stateAggregates}
          height={520}
        >
          <MapLibreCanvas style={style} bounds={US_BOUNDS} />
        </MapExplorer>
      </div>
    </main>
  );
}
