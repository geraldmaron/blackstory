/**
 * One research row of the Records register. The whole row is the link.
 *
 * The row reads as a small catalog card. At the left, the record's mark: its own photograph
 * toned as a plate, or, without one, a tile in its kind's map shade with the kind's icon (the
 * one `KindBadge` draws), and the kind's word on both. Then
 * the name with the decade at the right, the place led by its state's postal code (the code the
 * map prints on its counts) or a pin outside the states, the summary (or, when the reader
 * searched, the part that holds the term in bold), and a foot rule carrying the evidence: the
 * grade as a three-bar meter and its word, and the count of cited publishers. Shape and words
 * carry every signal, so no color stands alone.
 *
 * `compact` is the timeline's row: no summary and no decade, because the band already states it
 * and the reader is scanning time, not reading.
 *
 * The kind tile is the kind's mark, not a stand-in photograph: it never imitates an image. Quiet
 * records and renderings never reach the photo index. The tile uses the kind's own shade, never a
 * semantic tone, so a violence-adjacent record never wears an alarm hue.
 */
import React, { type CSSProperties } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileLines, faLocationDot } from '@fortawesome/free-solid-svg-icons';
import { findUsStateFromJurisdictionLabel } from '@repo/domain/map/geography';
import { GradeMeter } from '../../components/evidence/EvidenceList';
import { gradeDescription } from '../../lib/map-experience/evidence-grade';
import { kindEncodingFor } from '../../lib/map-experience/kind-encoding';
import { kindIconFor } from '../../lib/map-experience/kind-icons';
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
  const encoding = kindEncodingFor(row.kind);
  const summary =
    query.length > 0
      ? (matchSnippet(row.summary, query) ?? highlightSegments(row.summary, ''))
      : highlightSegments(row.summary, '');
  const sources = row.grade === null ? undefined : row.sourceCount;
  // The state as the map prints it on its counts; the place line still spells it out.
  const state = findUsStateFromJurisdictionLabel(row.place);
  return (
    <li className="ds-record" id={anchor}>
      <a
        className={compact ? 'ds-record__link ds-record__link--compact' : 'ds-record__link'}
        href={row.href}
        data-record-id={row.id}
        data-photo={photoUrl === undefined ? undefined : 'true'}
      >
        <span
          className={photoUrl === undefined ? 'ds-record__mark' : 'ds-record__mark ds-plate__tone'}
          style={{ '--kind-shade': encoding.shade } as CSSProperties}
        >
          {photoUrl === undefined ? null : (
            // The record's own photograph, toned as a plate; its credit is on the record page.
            // eslint-disable-next-line @next/next/no-img-element -- remote Commons thumbnail
            <img className="ds-plate__img" src={photoUrl} alt="" loading="lazy" decoding="async" />
          )}
          <span className="ds-record__kind">
            <FontAwesomeIcon icon={kindIconFor(row.kind)} className="ds-record__kind-icon" />
            <span className="ds-record__kind-word">{encoding.label}</span>
          </span>
        </span>
        <span className="ds-record__name">
          <Segments segments={highlightSegments(row.name, query)} />
        </span>
        {compact ? null : (
          <span className="ds-record__decade" data-undated={row.era === 'Undated' || undefined}>
            {row.era}
          </span>
        )}
        <span className="ds-record__place">
          {state ? (
            <abbr className="ds-record__state" title={state.name}>
              {state.postalCode}
            </abbr>
          ) : (
            <FontAwesomeIcon icon={faLocationDot} className="ds-record__icon" aria-hidden="true" />
          )}
          {row.place}
        </span>
        {compact || row.summary.length === 0 ? null : (
          <span className="ds-record__summary">
            <Segments segments={summary} />
          </span>
        )}
        <span className="ds-record__foot" title={gradeDescription(row.grade)}>
          <GradeMeter level={LEVEL_BY_GRADE[row.grade ?? 'none']} />
          {sources === undefined || compact ? null : (
            <span className="ds-record__sources">
              <FontAwesomeIcon icon={faFileLines} className="ds-record__icon" aria-hidden="true" />
              <span className="ds-record__sources-count">{sources.toLocaleString('en-US')}</span>
              {sources === 1 ? ' source' : ' sources'}
            </span>
          )}
        </span>
      </a>
    </li>
  );
}
