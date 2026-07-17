/**
 * Accessible toggle for the national density/coverage layer (the "presence, not just
 * incidents" layer). A native `<button aria-pressed>` rather than a checkbox styled as a switch 
 * matches this app's existing native-control-first convention (see `@black-book/ui`'s `Button`).
 */
import React from 'react';
import { Button } from '@black-book/ui';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;

export type DensityLayerToggleProps = {
  readonly enabled: boolean;
  readonly onToggle: () => void;
};

export function DensityLayerToggle({ enabled, onToggle }: DensityLayerToggleProps) {
  return (
    <Button
      type="button"
      variant={enabled ? 'primary' : 'secondary'}
      aria-pressed={enabled}
      onClick={onToggle}
    >
      {enabled ? 'Density layer: on' : 'Density layer: off'}
    </Button>
  );
}
