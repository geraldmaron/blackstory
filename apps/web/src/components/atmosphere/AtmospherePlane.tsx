/**
 * Decorative atmosphere plane for story (and future entity) masts.
 *
 * Soft B&W mosaic over a charcoal plate, with a flat geometric SVG always underneath.
 * Mosaic hides on tile load failure, Save-Data, or prefers-reduced-motion.
 * Plane is aria-hidden — attribution lives in adjacent copy.
 */
'use client';

import React, { useEffect, useState } from 'react';
import type { AtmospherePlaneSelection } from './select-atmosphere-plane';
import './atmosphere.css';

void React;

export type AtmospherePlaneProps = {
  readonly selection: AtmospherePlaneSelection;
  readonly className?: string;
  /** Caller-side geometric preference (e.g. feature flag); stacks with reduced-motion / Save-Data. */
  readonly preferGeometricClient?: boolean;
};

export function AtmospherePlane({
  selection,
  className,
  preferGeometricClient: preferGeometricClientProp,
}: AtmospherePlaneProps) {
  const [mosaicFailed, setMosaicFailed] = useState(false);
  const [preferGeometricClientEnv, setPreferGeometricClientEnv] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveData =
      typeof navigator !== 'undefined' &&
      'connection' in navigator &&
      Boolean(
        (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
          ?.saveData,
      );
    if (reducedMotion || saveData) {
      setPreferGeometricClientEnv(true);
    }
  }, []);

  const preferGeometricClient = Boolean(preferGeometricClientProp || preferGeometricClientEnv);

  const showMosaic =
    selection.mode === 'mosaic' &&
    selection.tiles.length > 0 &&
    !mosaicFailed &&
    !preferGeometricClient;

  const rootClass = ['ds-atmosphere', className].filter(Boolean).join(' ');

  return (
    <div className={rootClass} aria-hidden="true" data-plane-id={selection.planeId}>
      <div
        className="ds-atmosphere__geometric"
        style={{ backgroundImage: `url(${selection.geometric.path})` }}
      />
      {showMosaic ? (
        <div className="ds-atmosphere__mosaic">
          {selection.tiles.map((tile, index) => (
            // eslint-disable-next-line @next/next/no-img-element -- decorative mosaic cells; fail-closed via onError
            <img
              key={`${tile.path}-${index}`}
              className="ds-atmosphere__tile"
              src={tile.path}
              alt=""
              width={80}
              height={96}
              decoding="async"
              loading={index < 4 ? 'eager' : 'lazy'}
              onError={() => setMosaicFailed(true)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
