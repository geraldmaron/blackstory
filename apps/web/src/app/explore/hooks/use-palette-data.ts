import { useCallback, useMemo } from 'react';
import { browsableDestinations } from '../../../lib/nav/destination-registry';
import {
  type PaletteDestination,
  type PaletteRecord,
  type PaletteState,
} from '../../../components/patterns/command-palette/CommandPalette';
import { buildPaletteRecords } from '../../../lib/map-experience/build-palette-records';
import type { ExploreViewModel } from '../explore-view-model';

/** Everything the command palette searches: records, destinations, and states — plus the lookup. */
export function usePaletteData(
  view: ExploreViewModel,
  stateOptions: readonly { value: string; label: string }[],
) {
  /**
   * Name and place only, until repo-92n2.35 widened this to topic, kind, era and summary. The
   * build moved to `build-palette-records.ts` so what the index carries has a test over real
   * release features — a subject missing from the index is a subject the palette cannot find,
   * and that is not a fact a component test can establish.
   */
  const paletteRecords = useMemo<readonly PaletteRecord[]>(
    () => buildPaletteRecords(view.allFeatures),
    [view.allFeatures],
  );

  /**
   * The same three room groups as `/about`, the footer, and Rooms. Atlas, Records,
   * and the library hub stay off this list so the palette is not a second menu.
   */
  const destinations = useMemo<readonly PaletteDestination[]>(
    () =>
      browsableDestinations().map((destination) => ({
        href: destination.path,
        label: destination.label,
      })),
    [],
  );

  const paletteStates = useMemo<readonly PaletteState[]>(
    () => stateOptions.map((option) => ({ name: option.label })),
    [stateOptions],
  );

  const featureById = useCallback(
    (id: string) => view.allFeatures.find((feature) => feature.properties.entityId === id) ?? null,
    [view.allFeatures],
  );

  return { paletteRecords, destinations, paletteStates, featureById } as const;
}
