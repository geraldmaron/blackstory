/**
 * The errata log: one row per published change, newest first, grouped by day.
 *
 * A row is the record it changed (linked when the name resolves to exactly one published
 * record), its kind, the change in one line, and the note. A note longer than two lines is
 * clamped to two with a "Read the full note" toggle; the full text, and the list of records a
 * many-record change touched, are always in the HTML, so search, print and screen readers get
 * all of it. The day's date heads its group and stays in view while the group scrolls past.
 */
import React from 'react';
import Link from 'next/link';
import { DisplayNumeral } from '@repo/ui';
import { ERRATA_CHANGE_TYPE_LABELS } from '../../lib/trust/domain-trust';
import type { ErrataEntry } from '../../lib/trust/errata-seed';
import { errataDate, splitErrataHeadline } from './errata-headline';

void React;

/**
 * The date the errata log opened, for the empty-state sentence. Sourced from the earliest
 * seeded entry (`errata_methodology_launch_2026`) rather than hand-maintained separately.
 */
export const ERRATA_LOG_OPENED_DATE = '2026-07-17';

/** A trust page an entry points at, named in words. Record ids never reach a reader. */
function pageLabel(url: string | undefined): string | undefined {
  if (url === undefined) return undefined;
  if (url === '/methodology') return 'Methodology';
  if (url === '/corrections') return 'Corrections';
  return undefined;
}

export type ErrataSectionsProps = {
  readonly entries: readonly ErrataEntry[];
  /**
   * Record pages, from `resolveErrataRecordHrefs`: entry id to the record its headline names,
   * and `${entry id}#${name}` to each record a many-record entry lists.
   */
  readonly recordHrefs?: ReadonlyMap<string, string>;
};

/** Notes up to this many words fit two lines at the log's measure and are never clamped. */
const NOTE_CLAMP_WORDS = 28;

function ErrataRow({
  entry,
  recordHrefs,
}: {
  readonly entry: ErrataEntry;
  readonly recordHrefs: ReadonlyMap<string, string> | undefined;
}) {
  const { subject, change } = splitErrataHeadline(entry.headline);
  const affected =
    entry.affectedUrl !== undefined && !entry.affectedUrl.includes('ent_')
      ? entry.affectedUrl
      : undefined;
  const target = recordHrefs?.get(entry.id) ?? affected;
  const name = subject ?? pageLabel(affected) ?? 'The archive';
  const note = subject ? entry.summary : `${change}. ${entry.summary}`;
  const records = entry.affectedRecords ?? [];
  const clamp = records.length > 0 || note.split(/\s+/).length > NOTE_CLAMP_WORDS;
  const toggleId = `errata-more-${entry.id}`;

  return (
    <li className="ds-errata__row">
      <p className="ds-errata__head">
        {target ? (
          <Link className="ds-errata__name" href={target}>
            {name}
          </Link>
        ) : (
          <span className="ds-errata__name">{name}</span>
        )}
        {/* A correction changed a fact, so it reads heaviest: ink type under an ink rule. The
            rest are muted type under a hairline. */}
        <span
          className="ds-errata__type"
          data-kind={entry.changeType === 'correction' ? 'correction' : undefined}
        >
          {ERRATA_CHANGE_TYPE_LABELS[entry.changeType]}
        </span>
      </p>
      {subject ? <p className="ds-errata__change">{change}</p> : null}
      <div className="ds-errata__more" {...(clamp ? { 'data-clamp': '' } : {})}>
        {clamp ? (
          <input type="checkbox" id={toggleId} className="ds-errata__toggle ds-visually-hidden" />
        ) : null}
        <p className="ds-errata__note">{note}</p>
        {records.length > 0 ? (
          <ul
            className="ds-errata__records"
            aria-label={`Records this ${ERRATA_CHANGE_TYPE_LABELS[entry.changeType].toLowerCase()} touched`}
          >
            {records.map((record) => {
              const href = recordHrefs?.get(`${entry.id}#${record}`);
              return <li key={record}>{href ? <Link href={href}>{record}</Link> : record}</li>;
            })}
          </ul>
        ) : null}
        {clamp ? (
          <label htmlFor={toggleId} className="ds-errata__toggle-label">
            <span className="ds-errata__open">
              {records.length > 0
                ? `Read the full note and the ${records.length} records`
                : 'Read the full note'}
            </span>
            <span className="ds-errata__close">Show less</span>
          </label>
        ) : null}
      </div>
    </li>
  );
}

const MONTH_DAY = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/** Entries are newest first, so a day's entries are already adjacent. */
function byDay(entries: readonly ErrataEntry[]): { day: string; entries: ErrataEntry[] }[] {
  const days: { day: string; entries: ErrataEntry[] }[] = [];
  for (const entry of entries) {
    const day = errataDate(entry.timestamp);
    const last = days.at(-1);
    if (last?.day === day) last.entries.push(entry);
    else days.push({ day, entries: [entry] });
  }
  return days;
}

export function ErrataSections({ entries, recordHrefs }: ErrataSectionsProps) {
  if (entries.length === 0) {
    return (
      <p className="ds-errata__empty" role="status">
        No changes of this kind have been published. The log opened on {ERRATA_LOG_OPENED_DATE}, and
        every correction, clarification, update or editor’s note since is listed here.
      </p>
    );
  }

  return (
    <ol className="ds-errata__log" aria-label="Errata change log">
      {byDay(entries).map(({ day, entries: dayEntries }) => (
        <li key={day} className="ds-errata__day">
          <h2 className="ds-errata__date">
            <time dateTime={day}>
              <DisplayNumeral size="title" className="ds-errata__day-numeral">
                {MONTH_DAY.format(new Date(`${day}T00:00:00Z`))}
              </DisplayNumeral>{' '}
              <span className="ds-errata__year">{day.slice(0, 4)}</span>
            </time>
          </h2>
          <ol className="ds-errata__entries">
            {dayEntries.map((entry) => (
              <ErrataRow key={entry.id} entry={entry} recordHrefs={recordHrefs} />
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}
