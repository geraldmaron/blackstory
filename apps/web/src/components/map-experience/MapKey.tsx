/**
 * The map's key: precision is the encoding, so the key is the three marks beside their words. The
 * disc is an exact site, the open ring a city or area, the wash a county or state (no point). The
 * marks are drawn in CSS from the map's own tokens (`--ds-map-pin`, `--ds-map-ring`), so they
 * cannot drift from the plate. The strip carries it on a wide screen (`DecadeBrush`), the Filters
 * view on a phone.
 */
import React from 'react';
import { cx } from '@repo/ui';
import './map-key.css';

void React;

export function MapKey({ className }: { readonly className?: string }) {
  return (
    <p className={cx('ds-mapkey', className)}>
      {/* A paragraph cannot take aria-label; the name is text only a screen reader gets. */}
      <span className="ds-visually-hidden">How records are drawn: </span>
      <span className="ds-mapkey__item">
        <span className="ds-mapkey__mark ds-mapkey__mark--site" aria-hidden="true" />
        Exact site
      </span>
      <span className="ds-mapkey__item">
        <span className="ds-mapkey__mark ds-mapkey__mark--area" aria-hidden="true" />
        Within a city or area
      </span>
      <span className="ds-mapkey__item">
        <span className="ds-mapkey__mark ds-mapkey__mark--wash" aria-hidden="true" />
        County or state
      </span>
    </p>
  );
}
