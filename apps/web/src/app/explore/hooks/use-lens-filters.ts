import {
  matchExploreCollection,
  drawableCollection,
} from '../../../lib/discovery/explore-collection';
import { collectionMemberIds } from '../../../lib/discovery/story-collection';
import {
  documentedDecades,
  normalizePeriod,
  periodIsActive,
  periodIsInvalid,
  periodLabel,
  type CollectionPeriod,
} from '../../../lib/discovery/collection-period';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { findUsStateByPostalCode } from '@repo/domain/map/geography';
import type { UseToasts } from '../../../components/patterns/Toast';
import { decadeRangeLabel } from '../../../components/map-experience/DecadeBrush';
import { floorLabel, type EvidenceFloor } from '../../../lib/map-experience/evidence-grade';
import { decadeDensityBars } from '../../../lib/map-experience/decade-density';
import { buildTopicCounts, type TopicCount } from '../../../lib/map-experience/filters';
import { lensPermitsAreaFill } from '../../../lib/map-experience/lens-composition';
import {
  MAP_KIND_FAMILY_ENCODING,
  isKnownMapKind,
  isKnownMapKindFamily,
  kindFamilyEncodingFor,
  kindFamilyFor,
  type MapKindFamily,
} from '../../../lib/map-experience/kind-encoding';
import type { ExploreLayerMode } from '../../../lib/map-experience/url-state';
import type { ExploreViewModel } from '../explore-view-model';
import { decadeStartYear } from './atlas-feature-helpers';
import { sortExploreRows, type ExploreRowSort } from '../../../lib/map-experience/explore-rows';
import {
  applyNearbyRadius,
  nearestDistance,
  nearbyConstraintLabel,
  nearbyDistances,
  type NearbyArea,
} from '../../../lib/map-experience/nearby';

/** Layers a reader can toggle from the filter state of the column. */
export type LensLayers = {
  readonly pins: boolean;
  readonly routes: boolean;
  readonly labels: boolean;
  readonly satellite: boolean;
};

export type LensLayerKey = keyof LensLayers;

/** One active, clearable narrowing constraint, rendered as a chip in the Results header
 * (docs/ui/patterns-lens-handoff.md §3). `selected`, `collection` and `find` are named
 * exclusions there — they address rather than narrow — and none of them is built here. */
export type LensConstraint = {
  readonly key:
    'q' | 'near' | 'state' | 'kind' | 'topic' | 'status' | 'evidenceFloor' | 'decade' | 'period';
  readonly label: string;
  readonly onClear: () => void;
};

/**
 * The lens: every filter a reader can apply to the archive (state, kind, documented decades,
 * evidence floor, layer toggles, sort), and everything derived from them: the filtered and sorted
 * feature lists, the kind counts, and the decade histogram bars.
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
  /**
   * The brushed decade range: documented decades, never event years (`collection-period.ts`).
   * Seeded from `?periodStart=&periodEnd=` and written back through the URL sync like any filter.
   */
  const [period, setPeriodState] = useState<CollectionPeriod>(() =>
    normalizePeriod({
      start: view.viewState.periodStart,
      end: view.viewState.periodEnd,
      includeUndated: view.viewState.includeUndated,
    }),
  );
  const setPeriod = useCallback((start: number | null, end: number | null) => {
    setPeriodState(
      normalizePeriod({
        start: start === null ? '' : String(start),
        end: end === null ? '' : String(end),
      }),
    );
  }, []);
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
  const [sort, setDisplaySort] = useState<ExploreRowSort>(view.viewState.sort ?? 'discovery');
  const [bibliographySort, setBibliographySort] = useState(view.viewState.sort ?? 'discovery');
  const setSort = useCallback(
    (next: ExploreRowSort | ((current: ExploreRowSort) => ExploreRowSort)) => {
      setDisplaySort(next);
      if (next === 'discovery' || next === 'era' || next === 'name' || next === 'evidence')
        setBibliographySort(next);
    },
    [],
  );
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
    const {
      state: _state,
      floor: _floor,
      periodStart: _periodStart,
      periodEnd: _periodEnd,
      includeUndated: _includeUndated,
      ...base
    } = view.viewState;
    return {
      ...base,
      ...(period.start !== '' ? { periodStart: period.start } : {}),
      ...(period.end !== '' ? { periodEnd: period.end } : {}),
      ...(period.includeUndated ? { includeUndated: true } : {}),
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
    period,
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
  /** Released members of the named collection. Absent when the collection is unresolved, which
   *  makes a named collection match nothing rather than the whole archive. */
  const collectionMembers = useMemo(
    () => (view.collection ? collectionMemberIds(view.collection) : undefined),
    [view.collection],
  );
  const collectionMatches = useMemo(
    () =>
      view.collectionFacts
        ? matchExploreCollection(view.collectionFacts, collectionState, collectionMembers)
        : undefined,
    [view.collectionFacts, collectionState, collectionMembers],
  );
  /** Unlocated matches remain in collectionMatches; only drawable records enter the plate. */
  const lensFiltered = useMemo(
    () =>
      collectionMatches
        ? drawableCollection(view.allFeatures, collectionMatches)
        : view.filteredFeatures,
    [collectionMatches, view.allFeatures, view.filteredFeatures],
  );

  const filtered = useMemo(
    () => (nearby && distances ? applyNearbyRadius(lensFiltered, nearby, distances) : lensFiltered),
    [distances, lensFiltered, nearby],
  );

  /** Distance to the closest record the lens shows, inside the radius or not, so "nothing within
   * 5 miles" can still say where the nearest one is. */
  const nearestMeters = useMemo(
    () => (distances ? nearestDistance(lensFiltered, distances) : undefined),
    [distances, lensFiltered],
  );

  const topicCounts = useMemo<readonly TopicCount[]>(
    () => buildTopicCounts(view.allFeatures),
    [view.allFeatures],
  );

  /** The active topic's display label, when one is selected: the composition gate below needs
   * it, since a topic slug does not always spell out the violence term its own label does. */
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
      rows.push({ key: 'decade', label: era, onClear: () => setEra('all') });
    }
    if (periodIsActive(period)) {
      rows.push({
        key: 'period',
        // Worded as the decade dock words it, so the two never read as different filters.
        label:
          period.start !== '' && period.end !== '' && !periodIsInvalid(period)
            ? `${decadeRangeLabel({ start: Number(period.start), end: Number(period.end) })}${period.includeUndated ? ', plus undated' : ''}`
            : periodLabel(period),
        onClear: () => setPeriod(null, null),
      });
    }
    return rows;
  }, [
    query,
    era,
    exactKind,
    period,
    setPeriod,
    evidenceFloor,
    kindFamily,
    nearby,
    setNearby,
    stateCode,
    status,
    topicCounts,
    topicId,
  ]);

  const sorted = useMemo(
    () => sortExploreRows(filtered, sort, distances, periodIsActive(period) ? period : undefined),
    [distances, filtered, sort, period],
  );

  /**
   * Kind facet counts: what the column would count with that kind chosen and every other filter
   * applied. Run through the same match, drawable and radius steps as the list itself, so a
   * selected chip's number always equals the column's count.
   */
  const kindCounts = useMemo(() => {
    const counts: Partial<Record<MapKindFamily, number>> = {};
    for (const family of Object.keys(MAP_KIND_FAMILY_ENCODING) as MapKindFamily[]) {
      const rows = view.collectionFacts
        ? drawableCollection(
            view.allFeatures,
            matchExploreCollection(
              view.collectionFacts,
              { ...collectionState, filters: { ...collectionState.filters, kind: family } },
              collectionMembers,
            ),
          )
        : view.allFeatures.filter((feature) => feature.properties.kindFamily === family);
      counts[family] = (
        nearby && distances ? applyNearbyRadius(rows, nearby, distances) : rows
      ).length;
    }
    return counts;
  }, [
    collectionMembers,
    collectionState,
    distances,
    nearby,
    view.allFeatures,
    view.collectionFacts,
  ]);

  const stateOptions = useMemo(
    () =>
      view.facetOptions.state
        .filter((option) => option.value !== 'all')
        .map((option) => ({ value: option.value, label: option.label })),
    [view.facetOptions.state],
  );

  /**
   * The histogram: how the records every other filter leaves are spread across documented
   * decades. The brushed range itself is lifted, or brushing would erase the bars outside it and
   * the reader could never widen the range again. Before the catalog arrives, the release-wide
   * counts the shell already carries.
   */
  const decadeBars = useMemo(() => {
    if (!view.collectionFacts) {
      return decadeDensityBars(
        view.entityDecades.map((entry) => ({
          decade: decadeStartYear(entry.decade),
          count: entry.count,
        })),
      );
    }
    const {
      periodStart: _periodStart,
      periodEnd: _periodEnd,
      includeUndated: _includeUndated,
      ...unbrushed
    } = collectionState;
    const counts = new Map<number, number>();
    for (const fact of matchExploreCollection(view.collectionFacts, unbrushed, collectionMembers)) {
      for (const decade of documentedDecades(fact.eraBuckets)) {
        counts.set(decade, (counts.get(decade) ?? 0) + 1);
      }
    }
    return decadeDensityBars([...counts].map(([decade, count]) => ({ decade, count })));
  }, [collectionMembers, collectionState, view.collectionFacts, view.entityDecades]);

  const resetLens = useCallback(() => {
    const previous = {
      stateCode,
      kindFamily,
      exactKind,
      era,
      query,
      evidenceFloor,
      period,
      topicId,
      status,
      nearby,
    };
    setQuery('');
    setNearby(null);
    setStateCode('');
    setKindFamily(null);
    setEvidenceFloor('any');
    setPeriodState(normalizePeriod({}));
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
          setPeriodState(previous.period);
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
    period,
    evidenceFloor,
    kindFamily,
    nearby,
    setNearby,
    setKindFamily,
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
    period,
    setPeriod,
    topicId,
    setTopicId,
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
    stateOptions,
    decadeBars,
    constraints,
    resetLens,
  } as const;
}
