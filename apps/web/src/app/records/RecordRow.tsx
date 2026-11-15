/**
 * One research row of the Records register. The whole row is the link.
 *
 * Line one: the name, and at the right the decade and the evidence (the claims block's grade tag,
 * glyph and word, with the count of cited publishers). Line two: the kind as a word, the place, then the record's own
 * summary, or, when the reader searched, the part of the summary that holds the term with the
 * term in bold. The grade is a glyph and a word, never a color alone.
 *
 * `compact` is the timeline's row: one line, no summary, because the band already states the
 * decade and the reader is scanning time, not reading.
 *
 * A record with its own photograph opens on it, toned as a plate (one photo language); a record
 * without one gets no stand-in. Quiet records and renderings never reach the photo index.
 */
import React from 'react';
import { GradeTag } from '../../components/evidence/EvidenceList';
import { gradeDescription } from '../../lib/map-experience/evidence-grade';
import { kindEncodingFor } from '../../lib/map-experience/kind-encoding';
import type { RecordsRow } from '../../lib/records/build-records-index';
import {
  highlightSegments,
  matchSnippet,
  type TextSegment,
} from '../../lib/records/records-snippet';

void React;

function Segments({ segments }: { readonly segments: readonly TextSegment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.match ? <b key={index}>{segment.text}</b> : segment.text,
      )}
    </>
  );
}

const LEVEL_BY_GRADE = { A: 'high', B: 'medium', C: 'low', none: 'unrated' } as const;

function sourcesPhrase(count: number): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? 'source' : 'sources'}`;
}

export type RecordRowProps = {
  readonly row: RecordsRow;
  /** The reader's search term; marks it in the name and swaps the summary for a snippet. */
  readonly query: string;
  readonly compact?: boolean;
  /** Anchor id for the first row of a decade, the target of "Jump to decade". */
  readonly anchor?: string | undefined;
  /** The record's rights-cleared image, when it has one. */
  readonly photoUrl?: string | undefined;
};

export function RecordRow({ row, query, compact = false, anchor, photoUrl }: RecordRowProps) {
  const kind = kindEncodingFor(row.kind).label;
  const summary =
    query.length > 0
      ? (matchSnippet(row.summary, query) ?? highlightSegments(row.summary, ''))
      : highlightSegments(row.summary, '');
  return (
    <li className="ds-record" id={anchor}>
      <a
        className={compact ? 'ds-record__link ds-record__link--compact' : 'ds-record__link'}
        href={row.href}
        data-photo={photoUrl === undefined ? undefined : 'true'}
      >
        {photoUrl === undefined ? null : (
          // The record's own photograph, toned as a plate; its credit is on the record page.
          <span className="ds-record__thumb ds-plate__tone" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote Commons thumbnail */}
            <img className="ds-plate__img" src={photoUrl} alt="" loading="lazy" decoding="async" />
          </span>
        )}
        <span className="ds-record__name">
          <Segments segments={highlightSegments(row.name, query)} />
        </span>
        <span className="ds-record__meta">
          {kind}
          <span className="ds-record__sep" aria-hidden="true">
            {' · '}
          </span>
          <span className="ds-record__place">{row.place}</span>
        </span>
        <span className="ds-record__data">
          {compact ? null : <span className="ds-record__decade">{row.era}</span>}
          <span className="ds-record__evidence" title={gradeDescription(row.grade)}>
            <GradeTag level={LEVEL_BY_GRADE[row.grade ?? 'none']} />
            {row.grade === null || row.sourceCount === undefined ? null : (
              <span className="ds-record__sources">{sourcesPhrase(row.sourceCount)}</span>
            )}
          </span>
        </span>
        {compact || row.summary.length === 0 ? null : (
          <span className="ds-record__summary">
            <Segments segments={summary} />
          </span>
        )}
      </a>
    </li>
  );
}
