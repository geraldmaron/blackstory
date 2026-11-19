'use client';

/**
 * Where, as one compact control: a place field, a radius once a place is set, and how location
 * works behind a disclosure.
 *
 * Typing suggests matching records from the catalog already in hand; Enter resolves a city,
 * state, ZIP or address through `/locate/api` (the U.S. Census geocoder, server side, never a
 * browser map key). Locating the device is the map's own button. The field carries it at its
 * trailing edge only when the caller passes `onLocate`, which it does where that button is
 * covered (a phone sheet at full height), so one viewport never holds two locate controls.
 *
 * Location is opt-in: the browser prompt can only follow a press of a locate button, and nothing
 * runs on mount.
 */
import React, { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Segmented, cx } from '@repo/ui';
import { getRequestIntegrityHeaders } from '../../lib/request-integrity/client';
import { fetchLocateByAddress } from '../../lib/geocode/locate-client';
import type { ExploreMapFeature } from '../../lib/map-experience/build-explore-map-source';
import {
  EXPLORE_RADIUS_PRESETS,
  exploreRadiusPresetById,
  type ExploreRadiusPresetId,
} from '../../lib/map-experience/explore-place-radius';
import {
  resolveExploreAddressCamera,
  type ExploreAddressCameraTarget,
} from '../../lib/map-experience/resolve-explore-address-camera';
import {
  suggestCatalogRecords,
  type CatalogRecordSuggestion,
} from '../../lib/map-experience/suggest-catalog-records';
import { kindLabelForMark } from '../entity/record-mark';
import './place-control.css';

void React;

export type PlaceResolved =
  | { readonly kind: 'record'; readonly entityId: string }
  | { readonly kind: 'place'; readonly target: ExploreAddressCameraTarget };

export type PlaceControlProps = {
  readonly catalogFeatures: readonly ExploreMapFeature[];
  readonly onResolved: (resolved: PlaceResolved) => void;
  /** The surface's shared locate action, when the map's own locate button is out of sight. */
  readonly onLocate?: () => void;
  readonly locating?: boolean;
  /** True while a place (typed or the device's) narrows the map: the radius shows then. */
  readonly placed: boolean;
  readonly radiusId: ExploreRadiusPresetId;
  readonly onRadiusChange: (id: ExploreRadiusPresetId) => void;
  /** Focus the field on mount (`?find=place`). */
  readonly autoFocus?: boolean;
  readonly className?: string;
};

type Status =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string };

const ERRORS = {
  fallback: 'No place matched. Try a city and state, or a ZIP.',
  rate_limited: 'Too many lookups. Wait a moment and try again.',
  request_integrity_denied: 'This browser session could not be verified. Reload and try again.',
  invalid_query: 'That could not be read as an address, city or ZIP.',
  network_error: 'Place lookup is unreachable right now. Try again shortly.',
  no_camera: 'That place resolved, but the map could not frame it.',
} as const;

export function PlaceControl({
  catalogFeatures,
  onResolved,
  onLocate,
  locating = false,
  placed,
  radiusId,
  onRadiusChange,
  autoFocus = false,
  className,
}: PlaceControlProps) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [listOpen, setListOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldId = useId();
  const listId = useId();
  const statusId = useId();

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Suggestions belong to the moment of typing: any pointer outside closes them, the map included.
  useEffect(() => {
    if (!listOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setListOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [listOpen]);

  const deferred = useDeferredValue(query);
  const suggestions = useMemo(
    () => (deferred.trim().length < 2 ? [] : suggestCatalogRecords(deferred, catalogFeatures, 5)),
    [deferred, catalogFeatures],
  );
  // Two groups, so both kinds of search are visible: a place moves the map, a record opens it.
  const typed = deferred.trim();
  const showList = listOpen && typed.length >= 2;

  function pickRecord(record: CatalogRecordSuggestion) {
    setListOpen(false);
    setQuery(record.displayName);
    setStatus({ kind: 'idle' });
    onResolved({ kind: 'record', entityId: record.entityId });
  }

  async function lookUp(raw: string) {
    const text = raw.trim();
    if (!text) return;
    setListOpen(false);
    // A record named exactly is grounded in published coordinates: no geocoder round trip.
    const exact = suggestCatalogRecords(text, catalogFeatures, 1)[0];
    if (exact && exact.displayName.toLowerCase() === text.toLowerCase()) {
      pickRecord(exact);
      return;
    }
    setStatus({ kind: 'loading' });
    const result = await fetchLocateByAddress(text, await getRequestIntegrityHeaders(), {
      forCamera: true,
    });
    if (result.kind === 'resolved') {
      const target = resolveExploreAddressCamera(result.resolution);
      if (!target) {
        setStatus({ kind: 'error', message: ERRORS.no_camera });
        return;
      }
      setStatus({ kind: 'idle' });
      onResolved({ kind: 'place', target });
      return;
    }
    if (result.kind === 'fallback') {
      setStatus({ kind: 'error', message: result.fallback.message || ERRORS.fallback });
      return;
    }
    setStatus({
      kind: 'error',
      message:
        result.kind === 'rate_limited' ||
        result.kind === 'request_integrity_denied' ||
        result.kind === 'invalid_query'
          ? ERRORS[result.kind]
          : ERRORS.network_error,
    });
  }

  const loading = status.kind === 'loading';

  return (
    <div className={cx('ds-place', className)} ref={rootRef}>
      <form
        className="ds-place__field"
        role="search"
        aria-label="Find a place on the map"
        onSubmit={(event) => {
          event.preventDefault();
          void lookUp(query);
        }}
      >
        <svg className="ds-place__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M8 14.5s4.75-4.4 4.75-8.1a4.75 4.75 0 1 0-9.5 0c0 3.7 4.75 8.1 4.75 8.1Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <circle cx="8" cy="6.4" r="1.6" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        <label className="ds-visually-hidden" htmlFor={fieldId}>
          Place, ZIP or record name
        </label>
        <input
          ref={inputRef}
          id={fieldId}
          className="ds-place__input"
          type="search"
          name="place"
          autoComplete="off"
          enterKeyHint="search"
          placeholder="City, state, ZIP or record"
          value={query}
          aria-describedby={statusId}
          aria-controls={showList ? listId : undefined}
          aria-expanded={showList}
          aria-autocomplete="list"
          aria-busy={loading || undefined}
          onFocus={() => setListOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && listOpen) {
              event.preventDefault();
              event.stopPropagation();
              setListOpen(false);
            }
          }}
          onChange={(event) => {
            setListOpen(true);
            setQuery(event.currentTarget.value);
            if (status.kind === 'error') setStatus({ kind: 'idle' });
          }}
        />
        {onLocate ? (
          <button
            type="button"
            className="ds-place__locate"
            onClick={onLocate}
            disabled={locating}
            aria-busy={locating || undefined}
            aria-label={locating ? 'Finding your location' : 'Use my location'}
            title="Use my location"
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="M10 1.5v3M10 15.5v3M1.5 10h3M15.5 10h3"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ) : null}
      </form>

      {showList ? (
        <div className="ds-place__list" id={listId} role="listbox" aria-label="Places and records">
          <ul className="ds-place__group" role="group" aria-labelledby={`${listId}-places`}>
            <li className="ds-place__group-label" id={`${listId}-places`} role="presentation">
              Places
            </li>
            <li role="option" aria-selected={false}>
              <button type="button" className="ds-place__option" onClick={() => void lookUp(typed)}>
                <span className="ds-place__option-name">Find “{typed}” on the map</span>
                <span className="ds-place__option-kind">Place</span>
              </button>
            </li>
          </ul>
          {suggestions.length > 0 ? (
            <ul className="ds-place__group" role="group" aria-labelledby={`${listId}-records`}>
              <li className="ds-place__group-label" id={`${listId}-records`} role="presentation">
                Records
              </li>
              {suggestions.map((record) => (
                <li key={record.entityId} role="option" aria-selected={false}>
                  <button
                    type="button"
                    className="ds-place__option"
                    onClick={() => pickRecord(record)}
                  >
                    <span className="ds-place__option-name">{record.displayName}</span>
                    <span className="ds-place__option-kind">
                      {kindLabelForMark(record.kind) ?? record.kind}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <p className="ds-place__status" id={statusId} role="status" aria-live="polite">
        {loading ? 'Looking up that place…' : status.kind === 'error' ? status.message : ''}
      </p>

      {placed ? (
        <Segmented
          className="ds-place__radius"
          label="Distance from the place"
          name="explore-radius"
          value={radiusId}
          options={EXPLORE_RADIUS_PRESETS.map((preset) => ({
            value: preset.id,
            label: preset.id === 'all' ? 'Any' : preset.label,
          }))}
          onChange={(value) => onRadiusChange(exploreRadiusPresetById(value).id)}
        />
      ) : null}

      <details className="ds-place__privacy">
        <summary>How location works</summary>
        <p>
          Your device location is asked for only when you press a locate button, and it stays in
          this browser. A typed place goes to the U.S. Census geocoder to find its state, county and
          city, then is discarded.
        </p>
      </details>
    </div>
  );
}
