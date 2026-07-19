/**
 * Accessible control for the Explore map data model: entity presence density, Black population
 * share by county, or decade-over-decade share change. Uses a native radiogroup pattern with
 * 44px-friendly targets; population modes expose decennial controls (2000 | 2010 | 2020).
 */
import React from 'react';
import {
  CENSUS_POPULATION_DECADES,
  type CensusPopulationDecade,
} from '@repo/domain/map/county-population';
import type { ExploreLayerMode } from '../../lib/map-experience/url-state';

void React;

export type LayerModelControlProps = {
  readonly layerMode: ExploreLayerMode;
  readonly popDecade?: CensusPopulationDecade;
  readonly popFrom?: CensusPopulationDecade;
  readonly popTo?: CensusPopulationDecade;
  readonly onLayerModeChange: (mode: ExploreLayerMode) => void;
  readonly onPopDecadeChange: (decade: CensusPopulationDecade) => void;
  readonly onPopFromChange: (decade: CensusPopulationDecade) => void;
  readonly onPopToChange: (decade: CensusPopulationDecade) => void;
};

const LAYER_OPTIONS: readonly { readonly value: ExploreLayerMode; readonly label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'presence', label: 'Record presence' },
  { value: 'blackShare', label: 'Black population share' },
  { value: 'blackChange', label: 'Black share change' },
];

export function LayerModelControl({
  layerMode,
  popDecade = '2020',
  popFrom = '2010',
  popTo = '2020',
  onLayerModeChange,
  onPopDecadeChange,
  onPopFromChange,
  onPopToChange,
}: LayerModelControlProps) {
  return (
    <div className="ds-explore__layer-model">
      <fieldset className="ds-explore__layer-model-fieldset">
        <legend className="ds-sans">Map data model</legend>
        <div className="ds-explore__layer-model-options" role="radiogroup" aria-label="Map data model">
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

      {layerMode === 'blackShare' ? (
        <label className="ds-pill-select ds-explore__facet" htmlFor="explore-pop-decade">
          <span className="ds-pill-select__label">Census decade</span>
          <select
            className="ds-pill-select__control"
            id="explore-pop-decade"
            value={popDecade}
            onChange={(event) => onPopDecadeChange(event.currentTarget.value as CensusPopulationDecade)}
          >
            {CENSUS_POPULATION_DECADES.map((decade) => (
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
              onChange={(event) => onPopFromChange(event.currentTarget.value as CensusPopulationDecade)}
            >
              {CENSUS_POPULATION_DECADES.map((decade) => (
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
              onChange={(event) => onPopToChange(event.currentTarget.value as CensusPopulationDecade)}
            >
              {CENSUS_POPULATION_DECADES.map((decade) => (
                <option key={decade} value={decade}>
                  {decade}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
    </div>
  );
}
