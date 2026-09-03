/**
 * Lens — one scrolling panel, left edge, z 20.
 *
 * v6 put filters and the colour key behind segmented tabs, which hid half the instrument behind a
 * click. v9 removes the tabs: six hairline-separated groups in one scroll, everything visible at
 * once (design-direction-v9-atlas.md §5.2). The colour key is gone from here entirely — it lives
 * in the palette and the record sheet, where the encoding is actually being read.
 *
 * Filters auto-apply. There is no Apply button, carried from v6: a filter you have to confirm is a
 * filter you cannot explore with. Reset hands the previous state back to the caller so it can
 * offer undo rather than making the reader rebuild a lens from memory.
 *
 * This panel is a view over the existing explore view model — kind families, evidence floor and
 * `?state=` all already exist there. It adds no state of its own beyond the scroll fade.
 */
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cx } from '@repo/ui';
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
import type { ExploreLayerMode } from '../../lib/map-experience/url-state';
import { GradeDot } from './GradeDot';
import { KindFamilyGlyph } from './KindGlyph';
import './lens-panel.css';

void React;

/** Layers a reader can toggle without leaving the lens. */
export type LensLayers = {
  readonly pins: boolean;
  readonly routes: boolean;
  readonly labels: boolean;
  readonly satellite: boolean;
};

export type LensLayerKey = keyof LensLayers;

const LAYER_LABELS: Readonly<Record<LensLayerKey, string>> = {
  pins: 'Archive pins',
  routes: 'Migration routes',
  labels: 'Place labels',
  satellite: 'Satellite imagery',
};

export type PresenceRow = {
  readonly postalCode: string;
  readonly name: string;
  readonly count: number;
};

export type StateOption = { readonly value: string; readonly label: string };

/** The population layer choices the Lens exposes. `off` is "None" — pins alone, no choropleth. */
const POPULATION_LAYER_MODES: readonly ExploreLayerMode[] = ['off', 'blackShare', 'blackChange'];

const POPULATION_LAYER_LABELS: Readonly<Record<ExploreLayerMode, string>> = {
  off: 'None',
  presence: 'Record presence',
  blackShare: 'Black population share',
  blackChange: 'Black share change',
};

export type LensPanelProps = {
  /** Records matching the current lens, for the header count. */
  readonly matched: number;
  readonly total: number;

  readonly stateOptions: readonly StateOption[];
  readonly state: string;
  readonly onStateChange: (postalCode: string) => void;
  readonly onNearMe?: () => void;

  /** Live per-family counts over the unfiltered release, so a chip never reads zero-by-itself. */
  readonly kindCounts: Readonly<Partial<Record<MapKindFamily, number>>>;
  /** Single-select, matching the view model's `filters.kind`. Pressing the active chip clears it. */
  readonly kindFamily: MapKindFamily | null;
  readonly onKindFamilyChange: (family: MapKindFamily | null) => void;

  readonly evidenceFloor: EvidenceFloor;
  readonly onEvidenceFloorChange: (floor: EvidenceFloor) => void;

  /** Live counts over the unfiltered release, capped and ranked (`buildTopicCounts`). */
  readonly topicOptions: readonly TopicCount[];
  /** Single-select, same contract as `kindFamily`: pressing the active chip clears it. */
  readonly topicId: string | null;
  readonly onTopicChange: (id: string | null) => void;

  readonly layers: LensLayers;
  readonly onLayerToggle: (layer: LensLayerKey) => void;

  /** Population layer model: `off` for none, or one of the two comparability-noted choropleths.
   * `presence` is deliberately not offered here — it is the default map shading Explore already
   * carries, not a reader-facing "population" choice. */
  readonly layerMode: ExploreLayerMode;
  readonly onLayerModeChange: (mode: ExploreLayerMode) => void;

  readonly presence: readonly PresenceRow[];

  /** Opens the "Show the legend" overlay (§3, WP retained from v6). */
  readonly onShowLegend?: () => void;

  readonly onReset: () => void;
  readonly onHide?: () => void;
  readonly className?: string;
};

const KIND_FAMILIES = Object.keys(MAP_KIND_FAMILY_ENCODING) as readonly MapKindFamily[];

/** Grade the floor chip shows. `any` has no grade, so it shows no dot. */
function floorGrade(floor: EvidenceFloor) {
  return floor === 'any' ? null : floor;
}

export function LensPanel({
  matched,
  total,
  stateOptions,
  state,
  onStateChange,
  onNearMe,
  kindCounts,
  kindFamily,
  onKindFamilyChange,
  evidenceFloor,
  onEvidenceFloorChange,
  topicOptions,
  topicId,
  onTopicChange,
  layers,
  onLayerToggle,
  layerMode,
  onLayerModeChange,
  presence,
  onShowLegend,
  onReset,
  onHide,
  className,
}: LensPanelProps) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);

  /**
   * The bottom fade is an affordance, not decoration: without it a panel that scrolls looks
   * exactly like a panel that ends. It has to react to content changes too, not just scrolling —
   * changing the lens changes how many presence rows there are.
   */
  const syncOverflow = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    const remaining = body.scrollHeight - body.scrollTop - body.clientHeight;
    setOverflowing(remaining > 4);
  }, []);

  useEffect(() => {
    syncOverflow();
    const body = bodyRef.current;
    if (!body || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(syncOverflow);
    observer.observe(body);
    return () => observer.disconnect();
  }, [syncOverflow, presence.length, stateOptions.length]);

  const peak = presence[0]?.count ?? 0;

  return (
    <section
      className={cx('ds-lens', className)}
      aria-label="Lens: what you are looking at"
      data-overflowing={overflowing ? 'true' : undefined}
    >
      <header className="ds-lens__head">
        <h2 className="ds-lens__title">Lens</h2>
        <span className="ds-lens__count">
          {matched === total
            ? `${total.toLocaleString('en-US')} in view`
            : `${matched.toLocaleString('en-US')} in view`}
        </span>
        {onHide ? (
          <button type="button" className="ds-lens__hide" onClick={onHide} aria-label="Hide lens">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M10 3.5 5.5 8l4.5 4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
      </header>

      <div className="ds-lens__body" ref={bodyRef} onScroll={syncOverflow}>
        <div className="ds-lens__group">
          <div className="ds-lens__group-head">
            <span className="ds-lens__group-label">Where</span>
            {onNearMe ? (
              <button type="button" className="ds-lens__link" onClick={onNearMe}>
                Near me
              </button>
            ) : null}
          </div>
          <label className="ds-lens__field">
            <span className="ds-visually-hidden">State</span>
            <select
              className="ds-lens__select"
              value={state}
              onChange={(event) => onStateChange(event.target.value)}
            >
              <option value="">All states</option>
              {stateOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="ds-lens__group">
          <div className="ds-lens__group-head">
            <span className="ds-lens__group-label">Kind</span>
            <span className="ds-lens__hint">{KIND_FAMILIES.length} families</span>
          </div>
          <div className="ds-lens__chips" role="group" aria-label="Record kind">
            {KIND_FAMILIES.map((family) => {
              const pressed = kindFamily === family;
              return (
                <button
                  key={family}
                  type="button"
                  className="ds-lens__chip"
                  aria-pressed={pressed}
                  onClick={() => onKindFamilyChange(pressed ? null : family)}
                >
                  <KindFamilyGlyph family={family} size={13} />
                  {MAP_KIND_FAMILY_ENCODING[family].label}
                  <span className="ds-lens__chip-count">
                    {(kindCounts[family] ?? 0).toLocaleString('en-US')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <details
          className="ds-lens__advanced"
          {...(Boolean(topicId) ||
          evidenceFloor !== 'any' ||
          layerMode === 'blackShare' ||
          layerMode === 'blackChange' ||
          layers.routes ||
          layers.satellite ||
          !layers.pins ||
          !layers.labels
            ? { open: true }
            : {})}
        >
          <summary className="ds-lens__advanced-summary">More filters</summary>

          {topicOptions.length > 0 ? (
            <div className="ds-lens__group">
              <div className="ds-lens__group-head">
                <span className="ds-lens__group-label">Topic</span>
                <span className="ds-lens__hint">{topicOptions.length} shown</span>
              </div>
              <div className="ds-lens__chips" role="group" aria-label="Topic">
                {topicOptions.map((topic) => {
                  const pressed = topicId === topic.id;
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      className="ds-lens__chip"
                      aria-pressed={pressed}
                      onClick={() => onTopicChange(pressed ? null : topic.id)}
                    >
                      {topic.label}
                      <span className="ds-lens__chip-count">
                        {topic.count.toLocaleString('en-US')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="ds-lens__group">
            <div className="ds-lens__group-head">
              <span className="ds-lens__group-label">Evidence floor</span>
              <span className="ds-lens__hint">
                {evidenceFloor === 'any' ? 'Any grade' : floorLabel(evidenceFloor)}
              </span>
            </div>
            <div className="ds-lens__chips" role="group" aria-label="Minimum evidence grade">
              {EVIDENCE_FLOORS.map((floor) => (
                <button
                  key={floor}
                  type="button"
                  className="ds-lens__chip"
                  aria-pressed={evidenceFloor === floor}
                  onClick={() => onEvidenceFloorChange(floor)}
                >
                  {floor === 'any' ? null : <GradeDot grade={floorGrade(floor)} />}
                  {floorLabel(floor)}
                </button>
              ))}
            </div>
          </div>

          <div className="ds-lens__group">
            <div className="ds-lens__group-head">
              <span className="ds-lens__group-label">Layers</span>
            </div>
            <div className="ds-lens__chips" role="group" aria-label="Map layers">
              {(Object.keys(LAYER_LABELS) as readonly LensLayerKey[]).map((layer) => (
                <button
                  key={layer}
                  type="button"
                  className="ds-lens__chip"
                  aria-pressed={layers[layer]}
                  onClick={() => onLayerToggle(layer)}
                >
                  {LAYER_LABELS[layer]}
                </button>
              ))}
            </div>
            {onShowLegend ? (
              <button
                type="button"
                className="ds-lens__link ds-lens__show-legend"
                onClick={onShowLegend}
              >
                Show the legend
              </button>
            ) : null}
          </div>

          <div className="ds-lens__group">
            <div className="ds-lens__group-head">
              <span className="ds-lens__group-label">Population layer</span>
            </div>
            <div className="ds-lens__chips" role="group" aria-label="Population layer">
              {POPULATION_LAYER_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className="ds-lens__chip"
                  aria-pressed={layerMode === mode}
                  onClick={() => onLayerModeChange(layerMode === mode ? 'off' : mode)}
                >
                  {POPULATION_LAYER_LABELS[mode]}
                </button>
              ))}
            </div>
            {layerMode === 'blackShare' || layerMode === 'blackChange' ? (
              <p className="ds-lens__note">
                Published Census decennial counts, not modeled story density. Record presence and
                population share are two different measures and are not directly comparable: one
                counts documented entities in this archive, the other counts residents in a census
                year.
              </p>
            ) : null}
          </div>
        </details>

        <hr className="ds-lens__rule" />

        <div className="ds-lens__group">
          <div className="ds-lens__group-head">
            <span className="ds-lens__group-label">Deepest coverage</span>
            <span className="ds-lens__hint">this release</span>
          </div>
          <div className="ds-lens__bars">
            {presence.map((row) => (
              <button
                key={row.postalCode}
                type="button"
                className="ds-lens__bar"
                aria-pressed={state === row.postalCode}
                onClick={() => onStateChange(state === row.postalCode ? '' : row.postalCode)}
              >
                <span
                  className="ds-lens__bar-track"
                  style={
                    {
                      '--ds-bar-width': `${peak > 0 ? Math.round((row.count / peak) * 100) : 0}%`,
                    } as React.CSSProperties
                  }
                >
                  {row.name}
                </span>
                <span className="ds-lens__bar-count">{row.count.toLocaleString('en-US')}</span>
              </button>
            ))}
          </div>
        </div>

        <button type="button" className="ds-lens__reset" onClick={onReset}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3.5 3.5l9 9m0-9-9 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          Reset lens
        </button>
      </div>
    </section>
  );
}
