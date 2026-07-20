/**
 * Accessible control for the Explore map data model: entity presence density, Black population
 * share by state or county, or decade-over-decade share change. Uses a native radiogroup pattern
 * with 44px-friendly targets; population modes expose geography (state 1790–2020 | county
 * 2000–2020) and decennial controls with honest comparability notes when regimes shift.
 */
import React from 'react';
import {
  coercePopulationGeoForDecade,
  populationChangeComparabilityNote,
  populationDecadeComparabilityNote,
  populationDecadesForGeo,
  type ExplorePopulationGeo,
} from '../../lib/map-experience/explore-population';
import type { ExploreLayerMode } from '../../lib/map-experience/url-state';

void React;

export type LayerModelControlProps = {
  readonly layerMode: ExploreLayerMode;
  readonly popGeo?: ExplorePopulationGeo;
  readonly popDecade?: string;
  readonly popFrom?: string;
  readonly popTo?: string;
  readonly onLayerModeChange: (mode: ExploreLayerMode) => void;
  readonly onPopGeoChange: (geo: ExplorePopulationGeo) => void;
  readonly onPopDecadeChange: (decade: string) => void;
  readonly onPopFromChange: (decade: string) => void;
  readonly onPopToChange: (decade: string) => void;
};

const LAYER_OPTIONS: readonly { readonly value: ExploreLayerMode; readonly label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'presence', label: 'Record presence' },
  { value: 'blackShare', label: 'Black population share' },
  { value: 'blackChange', label: 'Black share change' },
];

export function LayerModelControl({
  layerMode,
  popGeo = 'county',
  popDecade = '2020',
  popFrom = '2010',
  popTo = '2020',
  onLayerModeChange,
  onPopGeoChange,
  onPopDecadeChange,
  onPopFromChange,
  onPopToChange,
}: LayerModelControlProps) {
  const resolvedGeo = coercePopulationGeoForDecade(popGeo, popDecade);
  const decades = populationDecadesForGeo(resolvedGeo);
  const shareNote = layerMode === 'blackShare' ? populationDecadeComparabilityNote(popDecade) : undefined;
  const changeNote =
    layerMode === 'blackChange'
      ? populationChangeComparabilityNote(popFrom, popTo) ??
        populationDecadeComparabilityNote(popTo)
      : undefined;

  return (
    <div className="ds-explore__layer-model">
      <fieldset className="ds-explore__layer-model-fieldset">
        <legend className="ds-sans">Map data model</legend>
        <div
          className="ds-explore__layer-model-options"
          role="radiogroup"
          aria-label="Map data model"
        >
          {LAYER_OPTIONS.map((option) => (
            <label className="ds-explore__layer-model-option" key={option.value}>
              <input
                type="radio"
                name="explore-layer-mode"
                value={option.value}
                checked={layerMode === option.value}
                onChange={() => onLayerModeChange(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {layerMode === 'blackShare' || layerMode === 'blackChange' ? (
        <fieldset className="ds-explore__layer-model-fieldset">
          <legend className="ds-sans">Geography</legend>
          <div
            className="ds-explore__layer-model-options"
            role="radiogroup"
            aria-label="Population geography"
          >
            <label className="ds-explore__layer-model-option">
              <input
                type="radio"
                name="explore-pop-geo"
                value="state"
                checked={resolvedGeo === 'state'}
                onChange={() => onPopGeoChange('state')}
              />
              <span>State (1790–2020)</span>
            </label>
            <label className="ds-explore__layer-model-option">
              <input
                type="radio"
                name="explore-pop-geo"
                value="county"
                checked={resolvedGeo === 'county'}
                onChange={() => onPopGeoChange('county')}
              />
              <span>County (2000–2020)</span>
            </label>
          </div>
          <p className="ds-sans ds-explore__settings-note">
            {resolvedGeo === 'state'
              ? 'State fills use published Census state totals — county detail is not available before 2000.'
              : 'County choropleths use modern decennial FIPS vintages only.'}
          </p>
        </fieldset>
      ) : null}

      {layerMode === 'blackShare' ? (
        <label className="ds-pill-select ds-explore__facet" htmlFor="explore-pop-decade">
          <span className="ds-pill-select__label">Census decade</span>
          <select
            className="ds-pill-select__control"
            id="explore-pop-decade"
            value={popDecade}
            onChange={(event) => onPopDecadeChange(event.currentTarget.value)}
          >
            {decades.map((decade) => (
              <option key={decade} value={decade}>
                {decade}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {layerMode === 'blackChange' ? (
        <div className="ds-explore__layer-model-range">
          <label className="ds-pill-select ds-explore__facet" htmlFor="explore-pop-from">
            <span className="ds-pill-select__label">From</span>
            <select
              className="ds-pill-select__control"
              id="explore-pop-from"
              value={popFrom}
              onChange={(event) => onPopFromChange(event.currentTarget.value)}
            >
              {decades.map((decade) => (
                <option key={decade} value={decade}>
                  {decade}
                </option>
              ))}
            </select>
          </label>
          <label className="ds-pill-select ds-explore__facet" htmlFor="explore-pop-to">
            <span className="ds-pill-select__label">To</span>
            <select
              className="ds-pill-select__control"
              id="explore-pop-to"
              value={popTo}
              onChange={(event) => onPopToChange(event.currentTarget.value)}
            >
              {decades.map((decade) => (
                <option key={decade} value={decade}>
                  {decade}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {shareNote ? (
        <p className="ds-sans ds-explore__settings-note" role="note">
          {shareNote}
        </p>
      ) : null}
      {changeNote ? (
        <p className="ds-sans ds-explore__settings-note" role="note">
          {changeNote}
        </p>
      ) : null}
    </div>
  );
}
