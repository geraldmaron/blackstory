/**
 * Errata log body — a plain, reverse-chronological hairline list.
 *
 * Design law: docs/ui/design-direction-v9-surfaces.md §4.2 "/errata". Every row carries a mono
 * date, a mono linked record id, a serif one-line statement of what changed and why, and the
 * public phase where one applies. Nothing here is a disclosure: the rule this screen exists to
 * prove is that the archive corrects itself in the open, and a collapsed details/summary row
 * would hide the proof behind a click.
 */
import React from 'react';
import Link from 'next/link';
import { ERRATA_CHANGE_TYPE_LABELS } from '../../lib/trust/domain-trust';
import type { ErrataEntry } from '../../lib/trust/errata-seed';

void React;

/**
 * The date the errata log opened, for the empty-state sentence. Sourced from the earliest
 * seeded entry (`errata_methodology_launch_2026`) rather than hand-maintained separately, so it
 * cannot drift from `lib/trust/errata-seed.ts` without a second edit there being noticed.
 */
export const ERRATA_LOG_OPENED_DATE = '2026-07-17';

function formatDate(timestamp: string): string {
  return timestamp.split('T')[0] ?? timestamp;
}

function publicErrataHref(url: string | undefined): string | undefined {
  if (url === undefined || url.trim().length === 0) return undefined;
  if (url.includes('ent_') || url.startsWith('/entity/')) return undefined;
  return url;
}

function ErrataRow({ entry }: { readonly entry: ErrataEntry }) {
  const phase = ERRATA_CHANGE_TYPE_LABELS[entry.changeType];
  const href = publicErrataHref(entry.affectedUrl);

  return (
    <li className="ds-errata__row">
      <time className="ds-errata__row-date" dateTime={entry.timestamp}>
        {formatDate(entry.timestamp)}
      </time>
      {href ? (
        <Link className="ds-errata__row-id" href={href}>
          {entry.id}
        </Link>
      ) : (
        <span className="ds-errata__row-id">{entry.id}</span>
      )}
      <p className="ds-errata__row-statement">
        {entry.headline}. {entry.summary}
      </p>
      <span className="ds-errata__row-phase">{phase}</span>
    </li>
  );
}

export function ErrataSections({ entries }: { readonly entries: readonly ErrataEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="ds-errata__empty" role="status">
        No corrections have been published yet. The log opened on {ERRATA_LOG_OPENED_DATE} and will
        list every correction, clarification, update and editor's note as soon as one is made.
      </p>
    );
  }

  return (
    <ol className="ds-errata__log" aria-label="Errata change log">
      {entries.map((entry) => (
        <ErrataRow key={entry.id} entry={entry} />
      ))}
    </ol>
  );
}
