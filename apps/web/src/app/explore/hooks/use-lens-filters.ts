import {
  matchExploreCollection,
  drawableCollection,
} from '../../../lib/discovery/explore-collection';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { findUsStateByPostalCode } from '@repo/domain/map/geography';
import type { UseToasts } from '../../../components/patterns/Toast';
import type { LensLayers } from '../../../components/map-experience/LensPanel';
import type { ResultsSort } from '../../../components/map-experience/ResultsRail';
import { floorLabel, type EvidenceFloor } from '../../../lib/map-experience/evidence-grade';
import { decadeDensityBars } from '../../../lib/map-experience/decade-density';
import { earliestDecadeFor } from '../../../lib/map-experience/decade-transition';
import { buildTopicCounts, type TopicCount } from '../../../lib/map-experience/filters';
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
  readonly key: 'q' | 'near' | 'state' | 'kind' | 'topic' | 'status' | 'evidenceFloor' | 'decade';
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
  const [query, setQuery] = useState(view.viewState.query ?? '');
  const [era, setEra] = useState(view.viewState.filters.era);
  const [exactKind, setExactKind] = useState<string | null>(
    isKnownMapKind(view.viewState.filters.kind) ? view.viewState.filters.kind : null,
  );
  const [kindFamily, setKindFamilyState] = useState<MapKindFamily | null>(() => {
    const kind = view.viewState.filters.kind;
    if (isKnownMapKindFamily(kind)) return kind;
    if (isKnownMapKind(kind)) return kindFamilyFor(kind);
    return null;
  });
  const setKindFamily = useCallback((next: MapKindFamily | null) => {
    setExactKind(null);
    setKindFamilyState(next);
  }, []);
  const [evidenceFloor, setEvidenceFloor] = useState<EvidenceFloor>(view.viewState.floor ?? 'any');
  const [decade, setDecadeState] = useState<number | null>(null);
  const setDecade = useCallback((next: number | null) => {
    setDecadeState(next);
    setEra(next === null ? 'all' : eraBucketFor(next));
  }, []);
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
  const [sort, setDisplaySort] = useState<ResultsSort>(view.viewState.sort ?? 'discovery');
  const [bibliographySort, setBibliographySort] = useState(view.viewState.sort ?? 'discovery');
  const setSort = useCallback((next: ResultsSort | ((current: ResultsSort) => ResultsSort)) => {
    setDisplaySort(next);
    if (next === 'discovery' || next === 'era' || next === 'name' || next === 'evidence')
      setBibliographySort(next);
  }, []);
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

  const collectionState = useMemo(() => {
    const { state: _state, floor: _floor, ...base } = view.viewState;
    return {
      ...base,
      query,
      sort: bibliographySort,
      ...(stateCode ? { state: stateCode } : {}),
      ...(evidenceFloor !== 'any' ? { floor: evidenceFloor } : {}),
      filters: {
        ...view.viewState.filters,
        kind: exactKind ?? kindFamily ?? 'all',
        era,
        theme: topicId ?? 'all',
        status: status ?? 'all',
      },
    } as const;
  }, [
    view.viewState,
    query,
    bibliographySort,
    stateCode,
    evidenceFloor,
    exactKind,
    kindFamily,
    era,
    topicId,
    status,
  ]);
  const collectionMatches = useMemo(
    () =>
      view.collectionFacts
        ? matchExploreCollection(view.collectionFacts, collectionState)
        : undefined,
    [view.collectionFacts, collectionState],
  );
  /** Unlocated matches remain in collectionMatches; only drawable records enter the plate. */
  const lensFiltered = useMemo(() => {
    let features = collectionMatches
      ? drawableCollection(view.allFeatures, collectionMatches)
      : view.filteredFeatures;
    if (sweepDecade !== null)
      features = features.filter((feature) => {
        const earliest = earliestDecadeFor(feature);
        return earliest !== null && earliest <= sweepDecade;
      });
    return features;
  }, [
    collectionMatches,
    collectionState,
    view.allFeatures,
    view.filteredFeatures,
    stateCode,
    evidenceFloor,
    sweepDecade,
  ]);

  const filtered = useMemo(
    () => (nearby && distances ? applyNearbyRadius(lensFiltered, nearby, distances) : lensFiltered),
    [distances, lensFiltered, nearby],
  );

  /** Distance to the closest record the lens shows, inside the radius or not — so "nothing within
   * 5 miles" can still say where the nearest one is. */
  const nearestMeters = useMemo(
    () =>
      distances
        ? nearestDistance(
            // The rail's own rows: internal placeholder records never show, so never count.
            lensFiltered.filter(
              (feature) => !isInternalRecordLabel(feature.properties.displayName),
            ),
            distances,
          )
        : undefined,
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
    if (query) rows.push({ key: 'q', label: `Matching “${query}”`, onClear: () => setQuery('') });
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
        label: exactKind ?? kindFamilyEncodingFor(kindFamily).label,
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
    if (era !== 'all') {
      rows.push({
        key: 'decade',
        label: era,
        onClear: () => setDecade(null),
      });
    }
    return rows;
  }, [
    query,
    era,
    exactKind,
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
    if (sort === 'discovery' || sort === 'era' || sort === 'name' || sort === 'evidence')
      return rows;
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
    const previous = {
      stateCode,
      kindFamily,
      exactKind,
      era,
      query,
      evidenceFloor,
      decade,
      topicId,
      status,
      nearby,
    };
    setQuery('');
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
          setExactKind(previous.exactKind);
          setEra(previous.era);
          setQuery(previous.query);
        },
      },
    });
  }, [
    query,
    era,
    exactKind,
    decade,
    evidenceFloor,
    kindFamily,
    nearby,
    setNearby,
    setKindFamily,
    setDecade,
    stateCode,
    status,
    toasts,
    topicId,
  ]);

  return {
    query,
    era,
    exactKind,
    collectionState,
    collectionMatched: collectionMatches?.length ?? view.totalMatched,
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
