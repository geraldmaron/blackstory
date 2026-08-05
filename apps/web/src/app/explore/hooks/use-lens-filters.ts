import { useCallback, useMemo, useState } from 'react';
import { findUsStateByPostalCode } from '@repo/domain/map/geography';
import type { UseToasts } from '../../../components/patterns/Toast';
import type { LensLayers } from '../../../components/map-experience/LensPanel';
import type { ResultsSort } from '../../../components/map-experience/ResultsRail';
import {
  applyEvidenceFloor,
  floorLabel,
  type EvidenceFloor,
} from '../../../lib/map-experience/evidence-grade';
import { decadeDensityBars } from '../../../lib/map-experience/decade-density';
import {
  buildTopicCounts,
  effectiveTopicIds,
  type TopicCount,
} from '../../../lib/map-experience/filters';
import {
  isKnownMapKindFamily,
  kindFamilyEncodingFor,
  type MapKindFamily,
} from '../../../lib/map-experience/kind-encoding';
import type { ExploreLayerMode } from '../../../lib/map-experience/url-state';
import type { ExploreViewModel } from '../explore-view-model';
import { decadeStartYear, eraBucketFor, eraFor } from './atlas-feature-helpers';

/** Presence rows shown in the lens. Ten is what fits without the panel becoming a table. */
const PRESENCE_ROWS = 10;

/** One active, clearable narrowing constraint, rendered as a chip in the Results header
 * (docs/ui/patterns-lens-handoff.md §3). `selected`, `collection` and `find` are named
 * exclusions there — they address rather than narrow — and none of them is built here. */
export type LensConstraint = {
  readonly key: 'state' | 'kind' | 'topic' | 'status' | 'evidenceFloor' | 'decade';
  readonly label: string;
  readonly onClear: () => void;
};

/** Reads `?floor=` directly rather than through `parseExploreSearchParams`: that parser lives in
 * `url-state.ts`, outside this package's file lock, and does not carry a `floor` key yet. This is
 * the seam SP-16 lands the floor into the Lens through until `url-state.ts` grows the param. */
function initialFloorFromLocation(): EvidenceFloor {
  if (typeof window === 'undefined') return 'any';
  const raw = new URLSearchParams(window.location.search).get('floor')?.trim().toUpperCase();
  return raw === 'A' || raw === 'B' || raw === 'C' ? raw : 'any';
}

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
  const [evidenceFloor, setEvidenceFloor] = useState<EvidenceFloor>(initialFloorFromLocation);
  const [decade, setDecade] = useState<number | null>(null);
  const [topicId, setTopicId] = useState<string | null>(
    view.viewState.filters.theme !== 'all' ? view.viewState.filters.theme : null,
  );
  const [status, setStatus] = useState<string | null>(
    view.viewState.filters.status !== 'all' ? view.viewState.filters.status : null,
  );
  const [layerMode, setLayerMode] = useState<ExploreLayerMode>(view.viewState.layerMode);
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
    if (topicId) {
      features = features.filter((feature) => effectiveTopicIds(feature).includes(topicId));
    }
    if (status) {
      features = features.filter((feature) => feature.properties.status === status);
    }
    if (decade !== null) {
      const bucket = eraBucketFor(decade);
      features = features.filter((feature) => feature.properties.eraBuckets.includes(bucket));
    }
    return applyEvidenceFloor(features, evidenceFloor);
  }, [decade, evidenceFloor, kindFamily, stateCode, status, topicId, view.allFeatures]);

  const topicCounts = useMemo<readonly TopicCount[]>(
    () => buildTopicCounts(view.allFeatures),
    [view.allFeatures],
  );

  const constraints = useMemo<readonly LensConstraint[]>(() => {
    const rows: LensConstraint[] = [];
    if (stateCode) {
      const name = findUsStateByPostalCode(stateCode)?.name ?? stateCode;
      rows.push({ key: 'state', label: name, onClear: () => setStateCode('') });
    }
    if (kindFamily) {
      rows.push({
        key: 'kind',
        label: kindFamilyEncodingFor(kindFamily).label,
        onClear: () => setKindFamily(null),
      });
    }
    if (topicId) {
      const match = topicCounts.find((entry) => entry.id === topicId);
      rows.push({
        key: 'topic',
        label: match?.label ?? topicId,
        onClear: () => setTopicId(null),
      });
    }
    if (status) {
      rows.push({ key: 'status', label: status, onClear: () => setStatus(null) });
    }
    if (evidenceFloor !== 'any') {
      rows.push({
        key: 'evidenceFloor',
        label: floorLabel(evidenceFloor),
        onClear: () => setEvidenceFloor('any'),
      });
    }
    if (decade !== null) {
      rows.push({
        key: 'decade',
        label: eraBucketFor(decade),
        onClear: () => setDecade(null),
      });
    }
    return rows;
  }, [decade, evidenceFloor, kindFamily, stateCode, status, topicCounts, topicId]);

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
    const previous = { stateCode, kindFamily, evidenceFloor, decade, topicId, status };
    setStateCode('');
    setKindFamily(null);
    setEvidenceFloor('any');
    setDecade(null);
    setTopicId(null);
    setStatus(null);
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
          setTopicId(previous.topicId);
          setStatus(previous.status);
        },
      },
    });
  }, [decade, evidenceFloor, kindFamily, stateCode, status, toasts, topicId]);

  return {
    stateCode,
    setStateCode,
    kindFamily,
    setKindFamily,
    evidenceFloor,
    setEvidenceFloor,
    decade,
    setDecade,
    topicId,
    setTopicId,
    status,
    setStatus,
    layerMode,
    setLayerMode,
    layers,
    setLayers,
    sort,
    setSort,
    filtered,
    sorted,
    kindCounts,
    topicCounts,
    presence,
    stateOptions,
    decadeBars,
    constraints,
    resetLens,
  } as const;
}
