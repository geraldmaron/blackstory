/**
 * Accessible toggle for map point grouping (clustering when zoomed out). Matches the
 * density-layer toggle pattern: native `aria-pressed` button, shareable via `/explore?group=0`.
 */
import React from 'react';
import { Button } from '@repo/ui';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;

export type GroupingToggleProps = {
  readonly enabled: boolean;
  readonly onToggle: () => void;
};

export function GroupingToggle({ enabled, onToggle }: GroupingToggleProps) {
  return (
    <Button
      type="button"
      variant={enabled ? 'primary' : 'secondary'}
      aria-pressed={enabled}
      onClick={onToggle}
    >
      {enabled ? 'Group nearby: on' : 'Group nearby: off'}
    </Button>
  );
}
