/**
 * Presentational result panel for the `/locate` geocode experience — renders either a
 * resolved jurisdiction (state/county/city names + a link into `/explore`) or the
 * manual-place-search fallback notice. Pure and server-safe (no hooks) so it stays trivially
 * SSR-render-testable with `renderToStaticMarkup`, matching this app's existing
 * `DegradedModeNotice.test.ts` pattern.
 *
 * Never renders `precision.lat`/`precision.lng` even when present — exact coordinates are
 * reduced when no longer needed. This component only ever reads the jurisdiction names and ids
 * off a resolution, never its coordinate fields.
 */
import React from 'react';
import Link from 'next/link';
import { Notice } from '@repo/ui';
import type { LocateClientResult } from '../../lib/geocode/locate-client';
import { buildLocateExploreHref } from '../../lib/geocode/locate-explore-href';

// See LocationPrivacyNotice.tsx's identical note: keeps this file safe under a classic JSX
// runtime (this app's own test runner) even though the automatic runtime doesn't need it.
void React;

export type LocationResolutionPanelProps = {
  readonly result: LocateClientResult;
};

const RATE_LIMIT_MESSAGE =
  'Too many location lookups in a row. Wait a moment and try again, or search by place name below.';
const APP_CHECK_MESSAGE =
  'This browser session could not be verified. Reload the page, or search by place name below.';
const NETWORK_ERROR_MESSAGE =
  'The location lookup service is temporarily unreachable. Search by place name below.';
const INVALID_QUERY_MESSAGE = 'That input could not be read as an address, ZIP, or coordinate.';

export function LocationResolutionPanel({ result }: LocationResolutionPanelProps) {
  if (result.kind === 'resolved') {
    const { match, jurisdictionIds } = result.resolution;
    const parts = [match.placeName, match.countyName, match.stateName].filter(
      (part): part is string => Boolean(part),
    );
    return (
      <Notice tone="warning" title="Location resolved">
        <p className="ds-sans">
          {parts.length > 0 ? parts.join(', ') : 'A U.S. jurisdiction was resolved for this input.'}
        </p>
        <p className="ds-mono" style={{ fontSize: '0.8125rem' }}>
          Jurisdiction: {jurisdictionIds.countyId ?? jurisdictionIds.stateId ?? jurisdictionIds.countryId}
        </p>
        <p className="ds-sans">
          <Link className="ds-cta ds-cta--ink" href={buildLocateExploreHref(result.resolution)}>
            Explore nearby (10 mi)
          </Link>
        </p>
      </Notice>
    );
  }

  if (result.kind === 'fallback') {
    return (
      <Notice tone="dispute" title="No address match">
        <p className="ds-sans">{result.fallback.message}</p>
        <p className="ds-sans">
          <Link className="ds-cta ds-cta--ink" href={result.fallback.searchHref}>
            Go to search
          </Link>
        </p>
      </Notice>
    );
  }

  const message =
    result.kind === 'rate_limited'
      ? RATE_LIMIT_MESSAGE
      : result.kind === 'app_check_denied'
        ? APP_CHECK_MESSAGE
        : result.kind === 'invalid_query'
          ? INVALID_QUERY_MESSAGE
          : NETWORK_ERROR_MESSAGE;

  return (
    <Notice tone="error" title="Lookup unavailable">
      <p className="ds-sans">{message}</p>
    </Notice>
  );
}
