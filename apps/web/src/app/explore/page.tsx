/**
 * Location discovery entry page — UI scaffold until BB-050 geocoding lands.
 */

import { EmptyState, MapFrame, Notice } from '@black-book/ui';
import { SeedDataNotice } from '../../components/SeedDataNotice';
import { listPublicEntities } from '../../data/public-seed';

export const metadata = {
  title: 'Explore',
  description: 'Discover place-connected Black history near a U.S. location (scaffold).',
};

export default function ExplorePage() {
  const entities = listPublicEntities();
  const pins = entities.map((entity, index) => ({
    id: entity.id,
    label: entity.displayName,
    x: entity.mapPin.x,
    y: entity.mapPin.y + index * 2,
  }));

  return (
    <main className="bb-container bb-page" id="main">
      <p className="bb-page__eyebrow">Location</p>
      <h1 className="bb-page__title">Explore by place</h1>
      <p className="bb-page__lede">
        Enter a current U.S. city or ZIP to discover nearby historical records. Live geocoding and
        radius search arrive in BB-050; this page shows schematic seed pins only.
      </p>

      <div className="bb-stack" style={{ marginTop: 'var(--bb-space-6)' }}>
        <SeedDataNotice compact />
        <Notice tone="warning" title="Geocoding not wired yet">
          Address lookup, ZIP-to-history matching, and distance ranking are deferred to BB-050. No
          residential street addresses are collected or displayed here.
        </Notice>

        <form className="bb-filters" method="get" action="/search" aria-label="Location discovery">
          <fieldset className="bb-filters__fieldset">
            <legend className="bb-filters__legend">Find history near a place</legend>
            <div className="bb-filters__fields">
              <div className="bb-filters__field">
                <label className="bb-filters__label" htmlFor="explore-q">
                  City or ZIP (modern input only)
                </label>
                <input
                  className="bb-filters__control"
                  id="explore-q"
                  name="q"
                  type="search"
                  placeholder="e.g. Washington or 20001"
                  autoComplete="address-level2"
                />
              </div>
            </div>
          </fieldset>
          <div className="bb-filters__actions">
            <button type="submit" className="bb-button bb-button--primary">
              Search sample catalog
            </button>
          </div>
        </form>

        <MapFrame
          title="Sample jurisdiction map"
          caption="Schematic fixture pins for seed place and school records — city/campus precision only."
          pins={pins}
        />

        <EmptyState
          title="Live nearby results coming later"
          action={
            <a className="bb-button bb-button--secondary" href="/search">
              Browse all sample records
            </a>
          }
        >
          Until geocoding ships, use Search to open the two seed entities shown on this map.
        </EmptyState>
      </div>
    </main>
  );
}
