'use client';

/**
 * PlaceFinder — the merged `/locate` experience, remounted into the Atlas Lens's Where group
 * (repo-92n2.14 / SP-14, `docs/ui/design-direction-v9-surfaces.md` §4.1 and §"`/locate`").
 *
 * One component, two postures:
 *   - Wide (>= `NARROW_BREAKPOINT`): renders inline inside the Lens's Where group, always
 *     visible, no trigger needed the panel has room.
 *   - Narrow (< `NARROW_BREAKPOINT`, matching `use-panel-visibility.ts`'s own threshold, which
 *     this file cannot import — it has no access to that hook's composite panel state, only the
 *     raw width test it is built on): the Where group shows a compact "Find a place" trigger, and
 *     the full form opens as a dedicated full-width, single-column sheet overlaying the plate,
 *     every control at least 44px tall (WCAG 2.5.5), matching `atlas.css`'s own dock convention.
 *
 * `?find=place` is a focus instruction, not a filter (the same class as `selected`/`collection` —
 * see `url-state.ts`'s doc comment and design-direction-v9-surfaces.md §4.1): arriving with it
 * opens the sheet once. Read directly off `window.location.search` in a post-mount effect rather
 * than `useSearchParams()`, which would suspend this subtree with no Suspense boundary above it
 * anywhere in `/explore`'s tree (`MapStage.tsx` documents the same avoidance for the same reason).
 * `narrow` and `open` both start `false` for a stable server-rendered markup, then correct after
 * mount — the same "server-rendered wide, corrected after mount" shape `use-panel-visibility.ts`
 * already uses, so this file never disagrees with the server about what it rendered.
 *
 * Geolocation is opt-in only: `LocationConsentButton`'s own `onClick` handler is the sole code
 * path that can trigger the browser permission prompt, and `/locate/api` (via
 * `fetchLocateByCoordinates`/`fetchLocateByAddress`) is only ever called from that button's
 * resolved callback or the address form's submit handler inside the remounted
 * `ExploreAddressSearch` — never from an effect, never on mount. A denied permission is handled
 * entirely inside `LocationConsentButton`, which falls back to a plain sentence next to the
 * manual field rather than an error state. `LocationPrivacyNotice` renders above every control in
 * both postures, forced open: it collapses by default behind a `<summary>` (right for `/locate`'s
 * old, lower-traffic standalone page), but this bead's acceptance criteria call for the full
 * four-point disclosure visible before permission is ever requested. The component has no `open`
 * prop to pass instead, so this file reaches into its own rendered `<details>` after mount.
 *
 * Radius (owned here, lifted into `ExploreAddressSearch` as a controlled prop) and the state
 * select (`LensPanel`'s own Where field, owned by the caller) are two different, non-composable
 * ways to narrow "where" to a place. Whichever the reader touched most recently wins and the
 * other is visibly cleared, never left showing a stale, contradicted value: picking a radius
 * clears an active state pick, and picking a state (the select, or the "Deepest coverage" bars)
 * clears an active radius.
 */
import React, { useEffect, useId, useRef, useState } from 'react';
import { getRequestIntegrityHeaders } from '../../lib/request-integrity/client';
import { fetchLocateByCoordinates, type LocateClientResult } from '../../lib/geocode/locate-client';
import type { BrowserCoordinates } from '../../lib/geocode/browser-geolocation';
import {
  buildCoarseLocationAnalyticsEvent,
  recordCoarseLocationAnalyticsEvent,
} from '../../lib/geocode/analytics-client';
import { LocationConsentButton } from '../location/LocationConsentButton';
import { LocationPrivacyNotice } from '../location/LocationPrivacyNotice';
import type { ExploreMapFeature } from '../../lib/map-experience/build-explore-map-source';
import {
  DEFAULT_EXPLORE_RADIUS_ID,
  exploreRadiusPresetById,
  type ExploreRadiusPresetId,
} from '../../lib/map-experience/explore-place-radius';
import { resolveExploreAddressCamera } from '../../lib/map-experience/resolve-explore-address-camera';
import { ExploreAddressSearch, type ExploreAddressResolvedPayload } from './ExploreAddressSearch';
import './place-finder.css';

void React;

export type PlaceFinderResolvedPayload = ExploreAddressResolvedPayload;

export type PlaceFinderProps = {
  /** Owned by the caller (`useLensFilters`) — the same `state`/`onStateChange` contract
   * `LensPanel`'s bare select and "Deepest coverage" bars already use. */
  readonly state: string;
  readonly onStateChange: (postalCode: string) => void;
  /** Live explore catalog for `ExploreAddressSearch`'s typeahead. Omitted (default `[]`) until a
   * caller wires the live features through; the rest of the finder works either way. */
  readonly catalogFeatures?: readonly ExploreMapFeature[];
  readonly onResolved?: (payload: PlaceFinderResolvedPayload) => void;
  readonly disabled?: boolean;
};

/** Matches `use-panel-visibility.ts`'s `NARROW_BREAKPOINT` (`apps/web/src/app/explore/hooks/`):
 * below this the Lens itself shrinks to a docked strip with no room for an inline form. */
const NARROW_BREAKPOINT = 820;

/**
 * "Radius and state select disagreement resolves to the most recent action, with the other
 * control visibly cleared" (repo-92n2.14 acceptance criterion). These two pure functions are the
 * whole rule, factored out of the component so they are unit-testable without a DOM
 * (`PlaceFinder.test.ts`) — this file has no jsdom-driven interaction tests anywhere else, only
 * SSR markup smoke tests, so logic that needs a click or a prop change to exercise has to live
 * somewhere a plain `node:test` can call it directly.
 */

/** True when picking `nextRadiusId` should clear an active state select. */
export function radiusPickClearsState(
  nextRadiusId: ExploreRadiusPresetId,
  activeState: string,
): boolean {
  return nextRadiusId !== 'all' && activeState !== '';
}

/** The radius the finder should fall back to once `nextState` is picked (by the select, or the
 * Lens's "Deepest coverage" bars) — `'all'` when it was clearing an active radius, unchanged
 * otherwise (picking "All states" while radius is already `'all'` is not a disagreement). */
export function statePickClearsRadius(
  nextState: string,
  activeRadiusId: ExploreRadiusPresetId,
): ExploreRadiusPresetId {
  return nextState !== '' && activeRadiusId !== 'all' ? 'all' : activeRadiusId;
}

type GeoStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string };

const GEO_ERROR_MESSAGES = {
  fallback: 'That location did not resolve to a U.S. jurisdiction. Use the search field instead.',
  rate_limited: 'Too many location lookups. Wait a moment and try again.',
  request_integrity_denied: 'This browser session could not be verified. Reload and try again.',
  invalid_query: 'That location could not be read.',
  network_error: 'Location lookup is temporarily unreachable.',
  no_camera: 'That location resolved, but the map could not frame it.',
} as const;

export function PlaceFinder({
  state,
  onStateChange,
  catalogFeatures = [],
  onResolved,
  disabled = false,
}: PlaceFinderProps) {
  const [radiusId, setRadiusIdState] = useState<ExploreRadiusPresetId>(DEFAULT_EXPLORE_RADIUS_ID);
  const [narrow, setNarrow] = useState(false);
  const [open, setOpen] = useState(false);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>({ kind: 'idle' });
  const privacyRef = useRef<HTMLDivElement | null>(null);
  const dialogTitleId = useId();

  const skipFirstStateSync = useRef(true);
  useEffect(() => {
    // The very first run reflects the state this component mounted with (e.g. a `?state=` deep
    // link), not a later reader action — nothing to resolve a disagreement against yet.
    if (skipFirstStateSync.current) {
      skipFirstStateSync.current = false;
      return;
    }
    const next = statePickClearsRadius(state, radiusId);
    if (next !== radiusId) setRadiusIdState(next);
  }, [state, radiusId]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(`(max-width: ${NARROW_BREAKPOINT - 1}px)`);
    const sync = () => setNarrow(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('find') === 'place') {
      setOpen(true);
    }
    // Read once, on arrival: `find` is a focus instruction, not live filter state to keep
    // resyncing from (see this file's doc comment and `url-state.ts`'s note on `selected`).
  }, []);

  // `LocationPrivacyNotice` collapses by default; force it open wherever this file mounts it, in
  // both postures. Runs after every render (cheap, idempotent) rather than once, because the
  // wide/narrow-open form is torn down and remounted as the reader resizes or opens the sheet.
  useEffect(() => {
    const details = privacyRef.current?.querySelector('details');
    if (details && !details.open) details.open = true;
  });

  function selectRadius(id: ExploreRadiusPresetId) {
    setRadiusIdState(id);
    if (radiusPickClearsState(id, state)) {
      onStateChange('');
    }
  }

  function handleResolved(payload: ExploreAddressResolvedPayload) {
    onResolved?.(payload);
  }

  function applyGeoResult(result: LocateClientResult) {
    if (result.kind === 'resolved') {
      recordCoarseLocationAnalyticsEvent(
        buildCoarseLocationAnalyticsEvent('browser_location_used', result.resolution),
      );
      const target = resolveExploreAddressCamera(result.resolution);
      if (!target) {
        setGeoStatus({ kind: 'error', message: GEO_ERROR_MESSAGES.no_camera });
        return;
      }
      setGeoStatus({ kind: 'idle' });
      const preset = exploreRadiusPresetById(radiusId);
      handleResolved({
        target,
        radiusMeters: preset.meters,
        radiusLabel: preset.statusLabel,
        radiusId: preset.id,
      });
      return;
    }
    if (result.kind === 'fallback') {
      recordCoarseLocationAnalyticsEvent(
        buildCoarseLocationAnalyticsEvent('geocode_failed', undefined),
      );
      setGeoStatus({
        kind: 'error',
        message: result.fallback.message || GEO_ERROR_MESSAGES.fallback,
      });
      return;
    }
    recordCoarseLocationAnalyticsEvent(
      buildCoarseLocationAnalyticsEvent('geocode_failed', undefined),
    );
    if (result.kind === 'rate_limited') {
      setGeoStatus({ kind: 'error', message: GEO_ERROR_MESSAGES.rate_limited });
      return;
    }
    if (result.kind === 'request_integrity_denied') {
      setGeoStatus({ kind: 'error', message: GEO_ERROR_MESSAGES.request_integrity_denied });
      return;
    }
    if (result.kind === 'invalid_query') {
      setGeoStatus({ kind: 'error', message: GEO_ERROR_MESSAGES.invalid_query });
      return;
    }
    setGeoStatus({ kind: 'error', message: GEO_ERROR_MESSAGES.network_error });
  }

  async function handleCoordinatesResolved(position: BrowserCoordinates) {
    setGeoStatus({ kind: 'loading' });
    const headers = await getRequestIntegrityHeaders();
    const result = await fetchLocateByCoordinates(position.lat, position.lng, headers, {
      forCamera: true,
    });
    applyGeoResult(result);
  }

  function handleGeoDenied() {
    // `LocationConsentButton` already renders the plain-sentence fallback itself; this only
    // records the coarse, resolution-free outcome (never the denial reason, never a coordinate).
    recordCoarseLocationAnalyticsEvent(
      buildCoarseLocationAnalyticsEvent('manual_fallback_used', undefined),
    );
  }

  const geoStatusMessage =
    geoStatus.kind === 'loading'
      ? 'Finding your jurisdiction…'
      : geoStatus.kind === 'error'
        ? geoStatus.message
        : '';

  function renderForm() {
    return (
      <div className="ds-place-finder__form">
        <div className="ds-place-finder__privacy" ref={privacyRef}>
          <LocationPrivacyNotice />
        </div>
        <LocationConsentButton
          onResolved={(position) => void handleCoordinatesResolved(position)}
          onDenied={handleGeoDenied}
          disabled={disabled}
        />
        <p className="ds-sans ds-place-finder__geo-status" role="status" aria-live="polite">
          {geoStatusMessage}
        </p>
        <ExploreAddressSearch
          onResolved={handleResolved}
          catalogFeatures={catalogFeatures}
          disabled={disabled}
          radiusId={radiusId}
          onRadiusChange={selectRadius}
        />
      </div>
    );
  }

  if (!narrow) {
    return <div className="ds-place-finder">{renderForm()}</div>;
  }

  if (!open) {
    return (
      <button
        type="button"
        className="ds-lens__link ds-place-finder__trigger"
        onClick={() => setOpen(true)}
      >
        Find a place
      </button>
    );
  }

  return (
    // No scrim: this sheet is edge-to-edge full-width by design (the whole point of the narrow
    // posture), so there is no "outside the dialog" region for a click-to-close scrim to ever
    // occupy — one would sit fully hidden behind the dialog and only cost a keyboard user an
    // extra, invisible Tab stop before reaching the actual content. `Escape`-to-close is not
    // wired either: `RecordSheet`/`ShortcutSheet` bind it globally at the Explore-instrument
    // level (`AtlasExperience.tsx`), which is outside this bead's file lock; the visible close
    // button is the one dismissal this file can own on its own.
    <div className="ds-place-sheet" role="dialog" aria-modal="true" aria-labelledby={dialogTitleId}>
      <div className="ds-place-sheet__dialog">
        <div className="ds-place-sheet__head">
          <h3 className="ds-place-sheet__title" id={dialogTitleId}>
            Find a place
          </h3>
          <button
            type="button"
            className="ds-place-sheet__close"
            aria-label="Close"
            onClick={() => setOpen(false)}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M3.5 3.5l9 9m0-9-9 9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="ds-place-sheet__body">{renderForm()}</div>
      </div>
    </div>
  );
}
