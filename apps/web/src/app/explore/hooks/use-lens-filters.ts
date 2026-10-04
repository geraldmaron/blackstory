import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { earliestDecadeFor } from '../../../lib/map-experience/decade-transition';
import {
  buildTopicCounts,
  effectiveTopicIds,
  type TopicCount,
} from '../../../lib/map-experience/filters';
import { lensPermitsAreaFill } from '../../../lib/map-experience/lens-composition';
import {
  isKnownMapKind,
  isKnownMapKindFamily,
  kindFamilyEncodingFor,
  kindFamilyFor,
  type MapKindFamily,
} from '../../../lib/map-experience/kind-encoding';
import type { ExploreLayerMode } from '../../../lib/map-experience/url-state';
import type { ExploreViewModel } from '../explore-view-model';
import { decadeStartYear, eraBucketFor, eraFor } from './atlas-feature-helpers';
import { isInternalRecordLabel } from '../../../lib/place/public-place-path';
import {
  applyNearbyRadius,
  nearestDistance,
  nearbyConstraintLabel,
  nearbyDistances,
  sortByDistance,
  type NearbyArea,
} from '../../../lib/map-experience/nearby';

/** Presence rows shown in the lens. Ten is what fits without the panel becoming a table. */
const PRESENCE_ROWS = 10;

/** One active, clearable narrowing constraint, rendered as a chip in the Results header
 * (docs/ui/patterns-lens-handoff.md §3). `selected`, `collection` and `find` are named
 * exclusions there — they address rather than narrow — and none of them is built here. */
export type LensConstraint = {
  readonly key: 'near' | 'state' | 'kind' | 'topic' | 'status' | 'evidenceFloor' | 'decade';
  readonly label: string;
  readonly onClear: () => void;
};

/**
 * The lens: every filter a reader can apply to the archive (state, kind, decade, evidence floor,
 * layer toggles, sort), and everything derived from them — the filtered/sorted feature lists, the
 * kind and state presence counts, and the decade histogram bars.
 */
export function useLensFilters(view: ExploreViewModel, toasts: UseToasts) {
  const [stateCode, setStateCode] = useState(view.viewState.state ?? '');
  const [kindFamily, setKindFamily] = useState<MapKindFamily | null>(() => {
    const kind = view.viewState.filters.kind;
    if (isKnownMapKindFamily(kind)) return kind;
    if (isKnownMapKind(kind)) return kindFamilyFor(kind);
    return null;
  });
  const [evidenceFloor, setEvidenceFloor] = useState<EvidenceFloor>(view.viewState.floor ?? 'any');
  const [decade, setDecade] = useState<number | null>(null);
  /**
   * The story sweep's cursor: show every record whose era had begun by this decade, cumulatively.
   *
   * Deliberately not the `decade` filter above. That one is the reader's own instrument and it is
   * a *window* — click the 1920s bar and you get the 1920s. The sweep is an argument about the
   * record accumulating, so it needs the opposite semantics, and folding the two together would
   * mean the histogram chip lied about what the map was showing. A value below the archive's
   * first decade empties the plate, which is how chapter 4 opens.
   */
  const [sweepDecade, setSweepDecade] = useState<number | null>(null);
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
  /**
   * A located point (the reader's device or a searched place). Narrows like any other lens
   * constraint: a chosen radius filters, and the rail sorts nearest-first while it is set.
   */
  const [nearby, setNearbyState] = useState<NearbyArea | null>(null);
  const setNearby = useCallback((next: NearbyArea | null) => {
    setNearbyState(next);
    setSort((current) => (next ? 'nearest' : current === 'nearest' ? 'oldest' : current));
    // A place-based "where" and a state pick are two answers to one question; the newest wins.
    if (next) setStateCode('');
  }, []);
  /** Picking a state replaces an active "near" — the most recent answer to "where" wins. */
  const pickState = useCallback((code: string) => {
    setStateCode(code);
    if (code) {
      setNearbyState(null);
      setSort((current) => (current === 'nearest' ? 'oldest' : current));
    }
  }, []);
  const distances = useMemo<ReadonlyMap<string, number> | null>(
    () => (nearby ? nearbyDistances(view.allFeatures, nearby.center) : null),
    [nearby, view.allFeatures],
  );

  /** Every lens constraint except the nearby radius: what the reader would see without it. */
  const lensFiltered = useMemo(() => {
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
    if (sweepDecade !== null) {
      features = features.filter((feature) => {
        const earliest = earliestDecadeFor(feature);
        return earliest !== null && earliest <= sweepDecade;
      });
    }
    return applyEvidenceFloor(features, evidenceFloor);
  }, [
    decade,
    evidenceFloor,
    kindFamily,
    stateCode,
    status,
    sweepDecade,
    topicId,
    view.allFeatures,
  ]);

  const filtered = useMemo(
    () => (nearby && distances ? applyNearbyRadius(lensFiltered, nearby, distances) : lensFiltered),
    [distances, lensFiltered, nearby],
  );

  /** Distance to the closest record the lens shows, inside the radius or not — so "nothing within
   * 5 miles" can still say where the nearest one is. */
  const nearestMeters = useMemo(
    () => (distances ? nearestDistance(lensFiltered, distances) : undefined),
    [distances, lensFiltered],
  );

  const topicCounts = useMemo<readonly TopicCount[]>(
    () => buildTopicCounts(view.allFeatures),
    [view.allFeatures],
  );

  /** The active topic's display label, when one is selected — the composition gate below and
   * `CameraConsole`'s lens-level move refusal both need it, since a topic slug does not always
   * spell out the violence term its own label does. */
  const activeTopicLabel = useMemo(
    () => (topicId ? (topicCounts.find((entry) => entry.id === topicId)?.label ?? null) : null),
    [topicId, topicCounts],
  );

  /** Composition dignity gate: whether the active
   * topic constraint permits a density/choropleth area fill to paint. */
  const areaFillPermitted = useMemo(
    () => lensPermitsAreaFill({ topicId, topicLabel: activeTopicLabel }),
    [topicId, activeTopicLabel],
  );

  // The gate is not only a chip-disable: a reader who already had a density/choropleth layer on
  // and then applies a violence-adjacent topic must not keep seeing it paint. Force back to the
  // discrete-points default the moment the constraint becomes violence-adjacent.
  useEffect(() => {
    if (!areaFillPermitted && (layerMode === 'blackShare' || layerMode === 'blackChange')) {
      setLayerMode('off');
    }
  }, [areaFillPermitted, layerMode]);

  const constraints = useMemo<readonly LensConstraint[]>(() => {
    const rows: LensConstraint[] = [];
    if (nearby) {
      rows.push({
        key: 'near',
        label: nearbyConstraintLabel(nearby),
        onClear: () => setNearby(null),
      });
    }
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
  }, [
    decade,
    evidenceFloor,
    kindFamily,
    nearby,
    setNearby,
    stateCode,
    status,
    topicCounts,
    topicId,
  ]);

  const sorted = useMemo(() => {
    const rows = filtered.filter(
      (feature) => !isInternalRecordLabel(feature.properties.displayName),
    );
    if (sort === 'nearest' && distances) return sortByDistance(rows, distances);
    rows.sort((a, b) => {
      const left = decadeStartYear(eraFor(a));
      const right = decadeStartYear(eraFor(b));
      if (left !== right) return sort === 'oldest' ? left - right : right - left;
      return a.properties.displayName.localeCompare(b.properties.displayName);
    });
    return rows;
  }, [distances, filtered, sort]);

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
    const previous = { stateCode, kindFamily, evidenceFloor, decade, topicId, status, nearby };
    setNearby(null);
    setStateCode('');
    setKindFamily(null);
    setEvidenceFloor('any');
    setDecade(null);
    setTopicId(null);
    setStatus(null);
    toasts.show({
      id: `reset-${Date.now()}`,
      message: 'Filters reset.',
      action: {
        label: 'Undo',
        run: () => {
          if (previous.nearby) setNearby(previous.nearby);
          setStateCode(previous.stateCode);
          setKindFamily(previous.kindFamily);
          setEvidenceFloor(previous.evidenceFloor);
          setDecade(previous.decade);
          setTopicId(previous.topicId);
          setStatus(previous.status);
        },
      },
    });
  }, [decade, evidenceFloor, kindFamily, nearby, setNearby, stateCode, status, toasts, topicId]);

  return {
    stateCode,
    setStateCode: pickState,
    kindFamily,
    setKindFamily,
    evidenceFloor,
    setEvidenceFloor,
    decade,
    setDecade,
    sweepDecade,
    setSweepDecade,
    topicId,
    setTopicId,
    activeTopicLabel,
    status,
    setStatus,
    layerMode,
    setLayerMode,
    areaFillPermitted,
    layers,
    setLayers,
    sort,
    setSort,
    nearby,
    setNearby,
    distances,
    filtered,
    nearestMeters,
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
