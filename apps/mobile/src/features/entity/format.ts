/**
 * Presentation-only string helpers for the entity detail screen (MOB-014).
 *
 * `formatEvidenceScoreLabel` and `humanizeToken` are deliberate, wording-exact ports of web's
 * `apps/web/src/lib/evidence/confidence-language.ts` / `apps/web/src/lib/evidence/format.ts` —
 * this bead's brief is explicit that mobile must "check the web's actual label strings and
 * match them, don't invent new wording." Every other function here (date/precision formatting)
 * is new to mobile because the wire shape it formats (`DatePrecision`, `FreshnessSignal`) has no
 * direct web equivalent to copy from.
 */
import type { ConfidenceLevel, DatePrecision } from './types';

const CONFIDENCE_LEVEL_TEXT: Readonly<Record<ConfidenceLevel, string>> = {
  high: 'high',
  medium: 'medium',
  low: 'low',
};

/**
 * Ported verbatim from web's `formatEvidenceScoreLabel` (uncalibrated path only — the public
 * contract's `claim.confidenceScore`/`confidenceLevel` are always the deterministic,
 * level-derived nominal score per `claim.ts`'s own doc comment, never a calibrated probability,
 * so the `calibrated: true` branch web supports has no real caller here and is intentionally
 * omitted). Produces e.g. "Evidence score: high (0.78 of 1.00)" — a score, never framed as a
 * probability that the claim is true.
 */
export function formatEvidenceScoreLabel(score: number, level: ConfidenceLevel): string {
  const bounded = Number.isFinite(score) ? Math.min(1, Math.max(0, score)) : 0;
  const rounded = bounded.toFixed(2);
  return `Evidence score: ${CONFIDENCE_LEVEL_TEXT[level]} (${rounded} of 1.00)`;
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
 * string for the offline/cached-content "last updated" banner (ADR-022 §3: "every cached
 * surface is explicitly labeled 'last updated <relative time>'"). An absolute UTC stamp (rather
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
