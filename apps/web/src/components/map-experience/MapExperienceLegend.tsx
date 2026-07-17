/**
 * Accessible legend for the BB-051 map: explains the density/coverage layer, the precision-radius
 * affordance, and the confidence glyphs in words — this is the a11y peer of the map's visual
 * legend, not a caption underneath it (WCAG 1.4.1 Use of Color: every visual distinction here also
 * has a text/glyph explanation).
 */
import React from 'react';
import { CONFIDENCE_TIER_GLYPH } from '../../lib/map-experience/dignity-style';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;

export function MapExperienceLegend() {
  return (
    <section className="bb-explore-legend" aria-labelledby="explore-legend-heading">
      <h2 className="bb-section__title" id="explore-legend-heading">
        Reading this map
      </h2>
      <dl className="bb-explore-legend__list">
        <div>
          <dt>Points</dt>
          <dd>
            Warm copper markers mark individual documented records. A shaded circle around a
            marker is a radius affordance, not a boundary &mdash; it shows how precisely the
            location is known, never an exact address.
          </dd>
        </div>
        <div>
          <dt>Clusters</dt>
          <dd>
            A number inside a marker means several records are grouped at this zoom level. Zoom in
            or activate a cluster to reveal the named records inside it &mdash; every cluster opens
            to individual entities within two interactions.
          </dd>
        </div>
        <div>
          <dt>Density layer (optional)</dt>
          <dd>
            When turned on, states are shaded by how many documented records they contain &mdash;
            presence, not incidents or severity. Darker shading means more documented records, not
            more danger.
          </dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>
            <span aria-hidden="true">{CONFIDENCE_TIER_GLYPH.high}</span> High,{' '}
            <span aria-hidden="true">{CONFIDENCE_TIER_GLYPH.medium}</span> medium, and{' '}
            <span aria-hidden="true">{CONFIDENCE_TIER_GLYPH.low}</span> low confidence reflect how
            strongly the strongest accepted claim on a record is evidenced &mdash; shown as a glyph
            and a word, never color alone.
          </dd>
        </div>
      </dl>
    </section>
  );
}
