'use client';

/**
 * Gradient legibility scrim for the Cinematic Map Backdrop (`docs/ui/patterns-cinematic-map.md`
 * §5 paint order `z1 .ds-map-scrim`). Opacity is driven by `[data-cinematic-state]` in
 * `cinematic-map.css` — full while Rest/Invite (locked, dimmed map), lifted to 0 in Engaged.
 * Purely decorative: never intercepts pointer/touch (`aria-hidden`, `pointer-events: none`).
 */
import React from 'react';
import { useCinematicMap } from './CinematicMapProvider';

void React;

export type CinematicScrimProps = {
  readonly className?: string;
};

export function CinematicScrim({ className }: CinematicScrimProps) {
  const { state } = useCinematicMap();
  const rootClass = ['ds-map-scrim', className].filter(Boolean).join(' ');

  return <div className={rootClass} data-cinematic-state={state} aria-hidden="true" />;
}
