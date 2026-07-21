'use client';

/**
 * Lean place finder for `/explore`: one search field + radius chips (All / 5–50 mi).
 * Suggests matching catalog records from already-loaded map data (deferred ranking so
 * typing stays responsive), then falls back to `/locate/api` (Census + city/state centroid)
 * for camera framing. Parent owns ranking. Place lookups are U.S.-only and server-side —
 * never a browser geocoder key.
 */
import React, { useDeferredValue, useId, useMemo, useState } from 'react';
import { Button } from '@repo/ui';
import { getExploreAppCheckHeaders } from '../../app/(map)/explore/app-check-client';
import { fetchLocateByAddress } from '../../lib/geocode/locate-client';
import type { ExploreMapFeature } from '../../lib/map-experience/build-explore-map-source';
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
import { CAMERA_COUNTY_ZOOM } from '../../lib/map-experience/camera-presets';
import {
  suggestCatalogRecords,
  type CatalogRecordSuggestion,
} from '../../lib/map-experience/suggest-catalog-records';

void React;

export type ExploreAddressResolvedPayload = {
  readonly target: ExploreAddressCameraTarget;
  /** `null` when radius is All — no circle filter. */
  readonly radiusMeters: number | null;
  readonly radiusLabel: string;
  readonly radiusId: ExploreRadiusPresetId;
  /** When the user picked a catalog record, the entity id for optional selection. */
  readonly entityId?: string;
};

export type ExploreAddressSearchProps = {
  readonly onResolved: (payload: ExploreAddressResolvedPayload) => void;
  /** Live explore catalog — recommendations are drawn from these published features. */
  readonly catalogFeatures?: readonly ExploreMapFeature[];
  readonly disabled?: boolean;
};

type SearchStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly label: string }
  | { readonly kind: 'error'; readonly message: string };

const ERROR_MESSAGES = {
  fallback: 'No match for that place. Try a city and state, a ZIP, or pick a record below.',
  rate_limited: 'Too many location lookups. Wait a moment and try again.',
  app_check_denied: 'This browser session could not be verified. Reload and try again.',
  invalid_query: 'That input could not be read as an address, city, or ZIP.',
  network_error: 'Location lookup is temporarily unreachable.',
  no_camera: 'That place resolved, but the map could not frame it.',
} as const;

function cameraFromCatalogRecord(record: CatalogRecordSuggestion): ExploreAddressCameraTarget {
  return {
    preset: 'locality',
    viewport: { lat: record.lat, lng: record.lng, zoom: CAMERA_COUNTY_ZOOM },
    label: record.jurisdictionLabel
      ? `${record.displayName}, ${record.jurisdictionLabel}`
      : record.displayName,
  };
}

export function ExploreAddressSearch({
  onResolved,
  catalogFeatures = [],
  disabled = false,
}: ExploreAddressSearchProps) {
  const [status, setStatus] = useState<SearchStatus>({ kind: 'idle' });
  const [radiusId, setRadiusId] = useState<ExploreRadiusPresetId>(DEFAULT_EXPLORE_RADIUS_ID);
  const [query, setQuery] = useState('');
  const statusId = useId();
  const fieldId = useId();
  const radiusGroupId = useId();
  const listboxId = useId();
  const loading = status.kind === 'loading' || disabled;
  const radiusPreset = exploreRadiusPresetById(radiusId);

  const recommendationsQuery = useDeferredValue(query);
  const recommendations = useMemo(
    () => suggestCatalogRecords(recommendationsQuery, catalogFeatures, 6),
    [recommendationsQuery, catalogFeatures],
  );

  function emitResolved(target: ExploreAddressCameraTarget, entityId?: string) {
    const preset = exploreRadiusPresetById(radiusId);
    onResolved({
      target,
      radiusMeters: preset.meters,
      radiusLabel: preset.statusLabel,
      radiusId: preset.id,
      ...(entityId ? { entityId } : {}),
    });
    setStatus({ kind: 'ready', label: target.label });
  }

  function pickRecord(record: CatalogRecordSuggestion) {
    setQuery(record.displayName);
    emitResolved(cameraFromCatalogRecord(record), record.entityId);
  }

  async function runSearch(address: string) {
    const trimmed = address.trim();
    if (!trimmed) return;

    // Exact / strong catalog hit first — grounded in published coords, no geocoder round-trip.
    const catalogHit = suggestCatalogRecords(trimmed, catalogFeatures, 1)[0];
    if (
      catalogHit &&
      catalogHit.displayName.toLowerCase() === trimmed.toLowerCase()
    ) {
      emitResolved(cameraFromCatalogRecord(catalogHit), catalogHit.entityId);
      return;
    }

    setStatus({ kind: 'loading' });
    const headers = await getExploreAppCheckHeaders();
    const result = await fetchLocateByAddress(trimmed, headers, { forCamera: true });

    if (result.kind === 'resolved') {
      const target = resolveExploreAddressCamera(result.resolution);
      if (!target) {
        setStatus({ kind: 'error', message: ERROR_MESSAGES.no_camera });
        return;
      }
      emitResolved(target);
      return;
    }

    // Geocoder miss: if catalog still has partial matches, keep them visible and surface error.
    if (result.kind === 'fallback') {
      if (recommendations.length > 0) {
        setStatus({
          kind: 'error',
          message: 'No street or city match — pick a record from the archive below, or try City, ST.',
        });
        return;
      }
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
            autoComplete="off"
            enterKeyHint="search"
            placeholder="Record, city, state, or ZIP"
            value={query}
            disabled={loading}
            aria-describedby={statusId}
            aria-controls={recommendations.length > 0 ? listboxId : undefined}
            aria-expanded={recommendations.length > 0}
            aria-autocomplete="list"
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              if (status.kind === 'error' || status.kind === 'ready') {
                setStatus({ kind: 'idle' });
              }
            }}
          />
        </label>
        <Button type="submit" disabled={loading || query.trim().length === 0}>
          {loading ? 'Looking up…' : 'Go'}
        </Button>
      </form>
      <p className="ds-explore-place__privacy">
        Place lookup uses the U.S. Census Geocoder on our servers — no third-party map keys in
        this browser. Coarse framing only; living residences stay off the public map.
      </p>

      {recommendations.length > 0 ? (
        <div className="ds-explore-place__recs">
          <p className="ds-explore-place__label" id={`${listboxId}-label`}>
            From the archive
          </p>
          <ul
            id={listboxId}
            className="ds-explore-place__rec-list"
            role="listbox"
            aria-labelledby={`${listboxId}-label`}
          >
            {recommendations.map((record) => (
              <li key={record.entityId} role="option">
                <button
                  type="button"
                  className="ds-explore-place__rec-btn"
                  disabled={loading}
                  onClick={() => pickRecord(record)}
                >
                  <span className="ds-explore-place__rec-name">{record.displayName}</span>
                  <span className="ds-mono ds-explore-place__rec-kind">{record.kind}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="ds-explore-place__radius" role="radiogroup" aria-labelledby={radiusGroupId}>
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
