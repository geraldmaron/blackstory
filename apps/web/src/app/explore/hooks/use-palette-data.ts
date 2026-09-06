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
   *
   * `view.unmappedPaletteRecords` is the other half of that same corpus (repo-jnmwu): entities
   * `exploreMapSourceFor` never turned into a map feature at all — mostly laws, cases, and
   * national organizations with no resolvable `geoAnchor` — precomputed server-side by
   * `buildUnmappedPaletteRecords` because it needs the full, unfiltered entity list this hook
   * never holds a client copy of. Without it, the palette answered a query differently than
   * `/search/api` did everywhere else on the site, for no reason a reader could see: the record
   * was real, indexed, and simply missing from this one search box.
   */
  const paletteRecords = useMemo<readonly PaletteRecord[]>(
    () => [...buildPaletteRecords(view.allFeatures), ...view.unmappedPaletteRecords],
    [view.allFeatures, view.unmappedPaletteRecords],
  );

  /**
   * The same three room groups as `/about`, the footer, and Rooms. Explore, Records,
   * and the rooms hub stay off this list so the palette is not a second menu.
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
