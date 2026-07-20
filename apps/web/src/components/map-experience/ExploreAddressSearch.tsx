'use client';

/**
 * Lean place finder for `/explore`: one search field + radius chips (All / 5–50 mi).
 * Calls `/locate/api` for camera framing; parent owns catalog ranking and empty-state intro.
 */
import React, { useId, useState } from 'react';
import { Button } from '@repo/ui';
import { getExploreAppCheckHeaders } from '../../app/(map)/explore/app-check-client';
import { fetchLocateByAddress } from '../../lib/geocode/locate-client';
import {
  DEFAULT_EXPLORE_RADIUS_ID,
  EXPLORE_RADIUS_PRESETS,
  exploreRadiusPresetById,
  isUnlimitedRadius,
  type ExploreRadiusPresetId,
} from '../../lib/map-experience/explore-place-radius';
import {
  resolveExploreAddressCamera,
  type ExploreAddressCameraTarget,
} from '../../lib/map-experience/resolve-explore-address-camera';

void React;

export type ExploreAddressResolvedPayload = {
  readonly target: ExploreAddressCameraTarget;
  /** `null` when radius is All — no circle filter. */
  readonly radiusMeters: number | null;
  readonly radiusLabel: string;
  readonly radiusId: ExploreRadiusPresetId;
};

export type ExploreAddressSearchProps = {
  readonly onResolved: (payload: ExploreAddressResolvedPayload) => void;
  readonly disabled?: boolean;
};

type SearchStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly label: string }
  | { readonly kind: 'error'; readonly message: string };

const ERROR_MESSAGES = {
  fallback: 'No match for that place. Try a city and state, or a ZIP.',
  rate_limited: 'Too many location lookups. Wait a moment and try again.',
  app_check_denied: 'This browser session could not be verified. Reload and try again.',
  invalid_query: 'That input could not be read as an address, city, or ZIP.',
  network_error: 'Location lookup is temporarily unreachable.',
  no_camera: 'That place resolved, but the map could not frame it.',
} as const;

export function ExploreAddressSearch({ onResolved, disabled = false }: ExploreAddressSearchProps) {
  const [status, setStatus] = useState<SearchStatus>({ kind: 'idle' });
  const [radiusId, setRadiusId] = useState<ExploreRadiusPresetId>(DEFAULT_EXPLORE_RADIUS_ID);
  const [query, setQuery] = useState('');
  const statusId = useId();
  const fieldId = useId();
  const radiusGroupId = useId();
  const loading = status.kind === 'loading' || disabled;
  const radiusPreset = exploreRadiusPresetById(radiusId);

  async function runSearch(address: string) {
    const trimmed = address.trim();
    if (!trimmed) return;

    setStatus({ kind: 'loading' });
    const headers = await getExploreAppCheckHeaders();
    const result = await fetchLocateByAddress(trimmed, headers, { forCamera: true });
    const preset = exploreRadiusPresetById(radiusId);

    if (result.kind === 'resolved') {
      const target = resolveExploreAddressCamera(result.resolution);
      if (!target) {
        setStatus({ kind: 'error', message: ERROR_MESSAGES.no_camera });
        return;
      }
      onResolved({
        target,
        radiusMeters: preset.meters,
        radiusLabel: preset.statusLabel,
        radiusId: preset.id,
      });
      setStatus({ kind: 'ready', label: target.label });
      return;
    }

    if (result.kind === 'fallback') {
      setStatus({ kind: 'error', message: result.fallback.message || ERROR_MESSAGES.fallback });
      return;
    }
    if (result.kind === 'rate_limited') {
      setStatus({ kind: 'error', message: ERROR_MESSAGES.rate_limited });
      return;
    }
    if (result.kind === 'app_check_denied') {
      setStatus({ kind: 'error', message: ERROR_MESSAGES.app_check_denied });
      return;
    }
    if (result.kind === 'invalid_query') {
      setStatus({ kind: 'error', message: ERROR_MESSAGES.invalid_query });
      return;
    }
    setStatus({ kind: 'error', message: ERROR_MESSAGES.network_error });
  }

  const statusMessage =
    status.kind === 'loading'
      ? 'Looking up place…'
      : status.kind === 'ready'
        ? isUnlimitedRadius(radiusPreset)
          ? `Centered on ${status.label}.`
          : `Centered on ${status.label} · ${radiusPreset.statusLabel}.`
        : status.kind === 'error'
          ? status.message
          : '';

  return (
    <div className="ds-explore-place">
      <form
        className="ds-explore-place__form"
        onSubmit={(event) => {
          event.preventDefault();
          void runSearch(query);
        }}
      >
        <label className="ds-explore-place__field" htmlFor={fieldId}>
          <span className="ds-explore-place__label">Place</span>
          <input
            id={fieldId}
            className="ds-explore-place__input"
            type="search"
            name="place"
            autoComplete="address-level2"
            enterKeyHint="search"
            placeholder="City, state, or ZIP"
            value={query}
            disabled={loading}
            aria-describedby={statusId}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </label>
        <Button type="submit" disabled={loading || query.trim().length === 0}>
          {loading ? 'Looking up…' : 'Go'}
        </Button>
      </form>

      <div
        className="ds-explore-place__radius"
        role="radiogroup"
        aria-labelledby={radiusGroupId}
      >
        <p className="ds-explore-place__label" id={radiusGroupId}>
          Radius
        </p>
        <div className="ds-explore-place__chips">
          {EXPLORE_RADIUS_PRESETS.map((preset) => {
            const selected = preset.id === radiusId;
            return (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={
                  selected
                    ? 'ds-explore-place__chip ds-explore-place__chip--selected'
                    : 'ds-explore-place__chip'
                }
                disabled={loading}
                onClick={() => setRadiusId(preset.id)}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      <p
        id={statusId}
        className="ds-sans ds-explore-place__status"
        role="status"
        aria-live="polite"
      >
        {statusMessage}
      </p>
    </div>
  );
}
