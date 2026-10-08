import { evidenceLabel } from '@repo/public-contracts/evidence';
/** Presentation helpers for dates, citations and qualitative evidence labels. */
import type { ConfidenceLevel, DatePrecision } from './types';

/** The public evidence label is qualitative; legacy scores never imply measurement. */
export function formatEvidenceScoreLabel(
  _score: number | undefined,
  level: ConfidenceLevel,
): string {
  return `Evidence: ${evidenceLabel(level)}`;
}

/** `"reputable_secondary"` -> `"Reputable Secondary"`. Ported verbatim from
 * `apps/web/src/lib/evidence/format.ts`'s `humanizeToken` — used for predicates, revision
 * change kinds, relation types, and status/event-type tokens, none of which ship a human label
 * of their own on the wire. */
export function humanizeToken(value: string): string {
  return value
    .split('_')
    .map((word) => (word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/**
 * A citation's source, as a reader would name it: `"wikipedia_api"` -> `"Wikipedia"`.
 *
 * The wire carries the connector that fetched the source, not the source. Printing the token
 * under the link showed the reader our plumbing — and "Wikipedia" twice, once as a link and once
 * as `wikipedia_api`.
 */
const CONNECTOR_SUFFIXES = ['_api', '_web', '_feed', '_v1', '_v2', '_client'] as const;

export function formatSourceName(source: string): string {
  let token = source.trim().toLowerCase();
  for (const suffix of CONNECTOR_SUFFIXES) {
    if (token.endsWith(suffix)) {
      token = token.slice(0, -suffix.length);
      break;
    }
  }
  if (token.length === 0) return source.trim();
  return humanizeToken(token);
}

/** `"2026-06-01T00:00:00.000Z"` -> `"2026-06-01"`. Ported verbatim from
 * `apps/web/src/lib/evidence/format.ts`'s `formatIsoDate`. Falls back to the raw string for any
 * value that is not an ISO-8601 date-time. */
export function formatIsoDate(value: string): string {
  const [datePart] = value.split('T');
  return datePart && datePart.length > 0 ? datePart : value;
}

const PRECISION_LABEL: Readonly<Record<DatePrecision, string>> = {
  day: 'day',
  month: 'month',
  year: 'year',
  decade: 'decade',
  circa: 'approximate',
};

/** A short caption naming how precise a date is, e.g. "Date precision: approximate". Never
 * invents a more specific reading of the underlying date than the server declared. */
export function datePrecisionCaption(precision: DatePrecision): string {
  return `Date precision: ${PRECISION_LABEL[precision]}`;
}

/**
 * Formats an epoch-ms timestamp as a deterministic, locale-independent "YYYY-MM-DD HH:MM UTC"
 * string for the offline/cached-content "last updated" banner (`docs/decisions-carryover.md`,
 * "Mobile cache and OTA release": every cached surface is explicitly labeled with when it was
 * last updated, and stale content is never presented as live). An absolute UTC stamp (rather
 * than a relative "3 hours ago" computation) is used deliberately: it needs no injected clock to
 * test deterministically, never goes stale mid-session the way a relative string would while a
 * screen stays mounted, and avoids depending on `Intl`/locale behavior in the Hermes runtime.
 */
export function formatFetchedAt(epochMs: number): string {
  if (!Number.isFinite(epochMs)) return 'an unknown time';
  const d = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  return `${date} ${time} UTC`;
}
