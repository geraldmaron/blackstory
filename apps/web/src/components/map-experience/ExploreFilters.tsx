/**
 * The filter state of the Explore column: where, what kind, when (on a phone), how well sourced,
 * which topic, the order of the list, and the opt-in map layers. Filters apply as they are set;
 * there is no Apply button, because a filter you have to confirm is one you cannot explore with.
 *
 * Built from the kit (Chip, Segmented) and nothing else. Each group is a sentence-case label over
 * its controls, separated by space, never by another box.
 */
'use client';

import React from 'react';
import { Chip, Segmented, cx } from '@repo/ui';
import {
  EVIDENCE_FLOORS,
  floorLabel,
  type EvidenceFloor,
} from '../../lib/map-experience/evidence-grade';
import type { TopicCount } from '../../lib/map-experience/filters';
import {
  MAP_KIND_FAMILY_ENCODING,
  type MapKindFamily,
} from '../../lib/map-experience/kind-encoding';
import { AREA_FILL_REFUSAL_NOTE } from '../../lib/map-experience/lens-composition';
import type { ExploreLayerMode } from '../../lib/map-experience/url-state';
import type { ExploreRowSort } from '../../lib/map-experience/explore-rows';
import './explore-refine.css';

void React;

const KIND_FAMILIES = Object.keys(MAP_KIND_FAMILY_ENCODING) as readonly MapKindFamily[];

/** Topics shown before the list stops: enough to scan, not a taxonomy dump. */
const TOPIC_LIMIT = 10;

/** Area shading, one at a time. Off unless the reader asks. */
const SHADING: readonly {
  readonly mode: Exclude<ExploreLayerMode, 'off'>;
  readonly label: string;
}[] = [
  { mode: 'presence', label: 'Record density by state' },
  { mode: 'blackShare', label: 'Black population share' },
  { mode: 'blackChange', label: 'Change in Black share' },
];

export type ExploreFilterLayers = {
  readonly routes: boolean;
  readonly labels: boolean;
  readonly satellite: boolean;
};

export type ExploreFiltersProps = {
  /** The place control, owned by the caller (it shares the surface's locate action). */
  readonly place: React.ReactNode;
  /** The decade histogram, set here on a phone; omitted where it docks on the map. */
  readonly when?: React.ReactNode;

  readonly kindCounts: Readonly<Partial<Record<MapKindFamily, number>>>;
  readonly kindFamily: MapKindFamily | null;
  readonly onKindFamilyChange: (family: MapKindFamily | null) => void;

  readonly evidenceFloor: EvidenceFloor;
  readonly onEvidenceFloorChange: (floor: EvidenceFloor) => void;

  readonly topics: readonly TopicCount[];
  readonly topicId: string | null;
  readonly onTopicChange: (id: string | null) => void;

  readonly sort: ExploreRowSort;
  readonly onSortChange: (sort: ExploreRowSort) => void;
  /** Nearest-first exists only while a place is set. */
  readonly canSortByDistance: boolean;

  readonly layerMode: ExploreLayerMode;
  readonly onLayerModeChange: (mode: ExploreLayerMode) => void;
  /** False while a violence-adjacent topic is active (`lensPermitsAreaFill`): no area fill paints. */
  readonly areaFillPermitted: boolean;
  readonly layers: ExploreFilterLayers;
  readonly onLayerToggle: (layer: keyof ExploreFilterLayers) => void;

  readonly className?: string;
};

function Group({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="ds-xrefine__group" role="group" aria-label={label}>
      <p className="ds-xrefine__label" aria-hidden="true">
        {label}
      </p>
      {children}
    </div>
  );
}

export function ExploreFilters({
  place,
  when,
  kindCounts,
  kindFamily,
  onKindFamilyChange,
  evidenceFloor,
  onEvidenceFloorChange,
  topics,
  topicId,
  onTopicChange,
  sort,
  onSortChange,
  canSortByDistance,
  layerMode,
  onLayerModeChange,
  areaFillPermitted,
  layers,
  onLayerToggle,
  className,
}: ExploreFiltersProps) {
  // Four at most, so each keeps a 44px target: Nearest takes Suggested's place once a place is set.
  const sortOptions = [
    canSortByDistance
      ? { value: 'nearest', label: 'Nearest' }
      : { value: 'discovery', label: 'Suggested' },
    { value: 'oldest', label: 'Earliest' },
    { value: 'newest', label: 'Latest' },
    { value: 'name', label: 'A to Z' },
  ];

  return (
    <div className={cx('ds-xrefine', className)}>
      <Group label="Where">{place}</Group>

      <Group label="Kind">
        <div className="ds-xrefine__values">
          {KIND_FAMILIES.map((family) => {
            const selected = kindFamily === family;
            return (
              <Chip
                key={family}
                className="ds-xrefine__value"
                selected={selected}
                onClick={() => onKindFamilyChange(selected ? null : family)}
              >
                {MAP_KIND_FAMILY_ENCODING[family].label}
                <span className="ds-xrefine__count">
                  {(kindCounts[family] ?? 0).toLocaleString('en-US')}
                </span>
              </Chip>
            );
          })}
        </div>
      </Group>

      {when ? <Group label="When">{when}</Group> : null}

      <Group label="Evidence">
        <Segmented
          label="Lowest evidence grade shown"
          name="explore-evidence"
          value={evidenceFloor}
          options={EVIDENCE_FLOORS.map((floor) => ({ value: floor, label: floorLabel(floor) }))}
          onChange={(value) => onEvidenceFloorChange(value as EvidenceFloor)}
        />
      </Group>

      {topics.length > 0 ? (
        <Group label="Topic">
          <div className="ds-xrefine__values">
            {topics.slice(0, TOPIC_LIMIT).map((topic) => {
              const selected = topicId === topic.id;
              return (
                <Chip
                  key={topic.id}
                  className="ds-xrefine__value"
                  selected={selected}
                  onClick={() => onTopicChange(selected ? null : topic.id)}
                >
                  {topic.label}
                </Chip>
              );
            })}
          </div>
        </Group>
      ) : null}

      <Group label="Order">
        <Segmented
          label="List order"
          name="explore-sort"
          value={sort}
          options={sortOptions}
          onChange={(value) => onSortChange(value as ExploreRowSort)}
        />
      </Group>

      <Group label="Map layers">
        <div className="ds-xrefine__values">
          {SHADING.map(({ mode, label }) => {
            const selected = layerMode === mode;
            return (
              <Chip
                key={mode}
                className="ds-xrefine__value"
                selected={selected}
                // Turning a fill off is always allowed; the gate refuses only turning one on.
                disabled={!selected && !areaFillPermitted}
                onClick={() => onLayerModeChange(selected ? 'off' : mode)}
              >
                {label}
              </Chip>
            );
          })}
          <Chip
            className="ds-xrefine__value"
            selected={layers.routes}
            onClick={() => onLayerToggle('routes')}
          >
            Migration routes
          </Chip>
          <Chip
            className="ds-xrefine__value"
            selected={layers.satellite}
            onClick={() => onLayerToggle('satellite')}
          >
            Satellite
          </Chip>
          <Chip
            className="ds-xrefine__value"
            selected={!layers.labels}
            onClick={() => onLayerToggle('labels')}
          >
            Hide place names
          </Chip>
        </div>
        {!areaFillPermitted ? (
          <p className="ds-xrefine__note" role="note">
            {AREA_FILL_REFUSAL_NOTE}
          </p>
        ) : layerMode === 'presence' ? (
          <p className="ds-xrefine__note">
            Shades each state by how many records this archive holds there. It measures the archive,
            not where history happened.
          </p>
        ) : layerMode === 'blackShare' || layerMode === 'blackChange' ? (
          <p className="ds-xrefine__note">
            Census decennial counts of residents, not records. Not comparable with record density.
          </p>
        ) : null}
      </Group>

      <div className="ds-xrefine__key" aria-label="How records are drawn">
        <span className="ds-xrefine__key-item">
          <span className="ds-xrefine__mark ds-xrefine__mark--dot" aria-hidden="true" />
          Known site
        </span>
        <span className="ds-xrefine__key-item">
          <span className="ds-xrefine__mark ds-xrefine__mark--ring" aria-hidden="true" />
          City or neighborhood
        </span>
        <span className="ds-xrefine__key-item">
          <span className="ds-xrefine__mark--tag" aria-hidden="true">
            N by county
          </span>
          County or state, no point
        </span>
      </div>
    </div>
  );
}
