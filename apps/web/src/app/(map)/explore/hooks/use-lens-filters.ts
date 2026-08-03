import { useCallback, useMemo, useState } from 'react';
import { findUsStateByPostalCode } from '@repo/domain/map/geography';
import type { UseToasts } from '../../../../components/patterns/Toast';
import type { LensLayers } from '../../../../components/map-experience/LensPanel';
import type { ResultsSort } from '../../../../components/map-experience/ResultsRail';
import {
  applyEvidenceFloor,
  type EvidenceFloor,
} from '../../../../lib/map-experience/evidence-grade';
import { decadeDensityBars } from '../../../../lib/map-experience/decade-density';
import {
  isKnownMapKindFamily,
  type MapKindFamily,
} from '../../../../lib/map-experience/kind-encoding';
import type { ExploreViewModel } from '../explore-view-model';
import { decadeStartYear, eraBucketFor, eraFor } from './atlas-feature-helpers';

/** Presence rows shown in the lens. Ten is what fits without the panel becoming a table. */
const PRESENCE_ROWS = 10;

/**
 * The lens: every filter a reader can apply to the archive (state, kind, decade, evidence floor,
 * layer toggles, sort), and everything derived from them — the filtered/sorted feature lists, the
 * kind and state presence counts, and the decade histogram bars.
 */
export function useLensFilters(view: ExploreViewModel, toasts: UseToasts) {
  const [stateCode, setStateCode] = useState(view.viewState.state ?? '');
  const [kindFamily, setKindFamily] = useState<MapKindFamily | null>(
    isKnownMapKindFamily(view.viewState.filters.kind)
      ? (view.viewState.filters.kind as MapKindFamily)
      : null,
  );
  const [evidenceFloor, setEvidenceFloor] = useState<EvidenceFloor>('any');
  const [decade, setDecade] = useState<number | null>(null);
  const [layers, setLayers] = useState<LensLayers>({
    pins: true,
    routes: false,
    labels: true,
    // Seeded from `?sat=1` so a shared satellite view opens as satellite.
    satellite: view.viewState.sat,
  });
  const [sort, setSort] = useState<ResultsSort>('oldest');

  const filtered = useMemo(() => {
    let features = view.allFeatures;
    if (stateCode) {
      features = features.filter((feature) => feature.properties.statePostalCode === stateCode);
    }
    if (kindFamily) {
      features = features.filter((feature) => feature.properties.kindFamily === kindFamily);
    }
    if (decade !== null) {
      const bucket = eraBucketFor(decade);
      features = features.filter((feature) => feature.properties.eraBuckets.includes(bucket));
    }
    return applyEvidenceFloor(features, evidenceFloor);
  }, [decade, evidenceFloor, kindFamily, stateCode, view.allFeatures]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      const left = decadeStartYear(eraFor(a));
      const right = decadeStartYear(eraFor(b));
      if (left !== right) return sort === 'oldest' ? left - right : right - left;
      return a.properties.displayName.localeCompare(b.properties.displayName);
    });
    return rows;
  }, [filtered, sort]);

  const kindCounts = useMemo(() => {
    const counts: Partial<Record<MapKindFamily, number>> = {};
    for (const feature of view.allFeatures) {
      const family = feature.properties.kindFamily as MapKindFamily;
      counts[family] = (counts[family] ?? 0) + 1;
    }
    return counts;
  }, [view.allFeatures]);

  const presence = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const feature of view.allFeatures) {
      const code = feature.properties.statePostalCode;
      if (!code) continue;
      const entry = counts.get(code) ?? {
        name: feature.properties.stateName ?? findUsStateByPostalCode(code)?.name ?? code,
        count: 0,
      };
      entry.count += 1;
      counts.set(code, entry);
    }
    return [...counts.entries()]
      .map(([postalCode, entry]) => ({ postalCode, name: entry.name, count: entry.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, PRESENCE_ROWS);
  }, [view.allFeatures]);

  const stateOptions = useMemo(
    () =>
      view.facetOptions.state
        .filter((option) => option.value !== 'all')
        .map((option) => ({ value: option.value, label: option.label })),
    [view.facetOptions.state],
  );

  const decadeBars = useMemo(
    () =>
      decadeDensityBars(
        view.entityDecades.map((entry) => ({
          decade: decadeStartYear(entry.decade),
          count: entry.count,
        })),
      ),
    [view.entityDecades],
  );

  const resetLens = useCallback(() => {
    const previous = { stateCode, kindFamily, evidenceFloor, decade };
    setStateCode('');
    setKindFamily(null);
    setEvidenceFloor('any');
    setDecade(null);
    toasts.show({
      id: `reset-${Date.now()}`,
      message: 'Lens reset.',
      action: {
        label: 'Undo',
        run: () => {
          setStateCode(previous.stateCode);
          setKindFamily(previous.kindFamily);
          setEvidenceFloor(previous.evidenceFloor);
          setDecade(previous.decade);
        },
      },
    });
  }, [decade, evidenceFloor, kindFamily, stateCode, toasts]);

  return {
    stateCode,
    setStateCode,
    kindFamily,
    setKindFamily,
    evidenceFloor,
    setEvidenceFloor,
    decade,
    setDecade,
    layers,
    setLayers,
    sort,
    setSort,
    filtered,
    sorted,
    kindCounts,
    presence,
    stateOptions,
    decadeBars,
    resetLens,
  } as const;
}
