/**
 * Decorative atmosphere plane for story (and future entity) masts.
 * Renders a flat geometric SVG plate on charcoal. Decorative only — aria-hidden.
 */
'use client';

import React from 'react';
import type { AtmospherePlaneSelection } from './select-atmosphere-plane';
import './atmosphere.css';

void React;

export type AtmospherePlaneProps = {
  readonly selection: AtmospherePlaneSelection;
  readonly className?: string;
};

export function AtmospherePlane({ selection, className }: AtmospherePlaneProps) {
  const rootClass = ['ds-atmosphere', className].filter(Boolean).join(' ');

  return (
    <div className={rootClass} aria-hidden="true" data-plane-id={selection.planeId}>
      <div
        className="ds-atmosphere__geometric"
        style={{ backgroundImage: `url(${selection.geometric.path})` }}
      />
    </div>
  );
}
