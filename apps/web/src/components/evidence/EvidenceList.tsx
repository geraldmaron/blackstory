/**
 * "What the sources say": a numbered evidence list, one entry per statement.
 *
 * Each entry is a statement and its own receipt (docs/ui/DESIGN.md section 7.3): the source as a
 * link, its publisher and date, then the grade as a glyph and a word, never color alone, never a
 * letter. A receipt belongs to one claim. A disputed value prints both values, each with the
 * source it came from; a retraction stays inline under the statement it qualifies.
 *
 * `id` is the entry's address (`#id`) and must be persistent: a claim passes its stored claim id.
 * The printed number is a reading aid and is never the address.
 *
 * Law and book pages pass sources with no graded statement; the list then numbers the sources
 * themselves, so all five record families cite the same way.
 */
import React, { type ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Receipt, type ConfidenceLevel } from '@repo/ui';
import { confidenceTierPhrase } from '../../lib/evidence/confidence-language';
import { confidenceIconFor } from '../../lib/map-experience/confidence-icons';
import type { EvidenceDisputeView, EvidenceRetractionNotice } from '../../lib/evidence';
import { sourceDisplayName } from '../../lib/evidence/source-label';
import { formatRecordDate } from '../patterns/format-record-date';
import { METHODOLOGY_EVIDENCE_GRADES_HREF } from './editorial-links';
import './evidence-list.css';

void React;

export type EvidenceSource = {
  /** The organization or site that published the source. */
  readonly publisher?: string;
  readonly title: string;
  readonly href?: string;
  /** A date the source carries (published, reported, retrieved), already formatted. */
  readonly date?: string;
  readonly archivedUrl?: string;
  readonly archivedAt?: string;
  /** Plain-text qualifier: a license, a withheld excerpt reason. */
  readonly note?: string;
};

export type EvidenceItem = {
  readonly id: string;
  readonly statement?: ReactNode;
  readonly source: EvidenceSource;
  readonly level?: ConfidenceLevel;
  readonly dispute?: EvidenceDisputeView;
  readonly retraction?: EvidenceRetractionNotice;
};

/**
 * The quiet grade tag: glyph plus word, colored by tier but never only by color. The one evidence
 * vocabulary: the claims block, the register's rows and the Explore list all print it.
 */
export function GradeTag({ level }: { readonly level: ConfidenceLevel | 'unrated' }) {
  return (
    <span className={`ds-grade-tag ds-grade-tag--${level}`}>
      <FontAwesomeIcon
        icon={confidenceIconFor(level)}
        className="ds-grade-tag__glyph"
        aria-hidden="true"
      />
      {confidenceTierPhrase(level)}
    </span>
  );
}

const METER_FILLED: Readonly<Record<ConfidenceLevel | 'unrated', number>> = {
  high: 3,
  medium: 2,
  low: 1,
  unrated: 0,
};

/**
 * The grade as a meter: three rising bars, as many filled as the grade earns, then the word. The
 * filled count carries the grade without color, and the word carries it without sight.
 */
export function GradeMeter({ level }: { readonly level: ConfidenceLevel | 'unrated' }) {
  const filled = METER_FILLED[level];
  return (
    <span className={`ds-grade-meter ds-grade-tag--${level}`}>
      <span className="ds-grade-meter__bars" aria-hidden="true">
        {[0, 1, 2].map((bar) => (
          <span
            key={bar}
            className="ds-grade-meter__bar"
            data-on={bar < filled ? 'true' : undefined}
          />
        ))}
      </span>
      <span className="ds-grade-meter__word">{confidenceTierPhrase(level)}</span>
    </span>
  );
}

function sourceReceipt(source: EvidenceSource, level?: ConfidenceLevel) {
  const publisher = source.publisher && sourceDisplayName(source.publisher, source.href);
  const title = sourceDisplayName(source.title, source.href);
  const detail = [
    publisher && publisher.toLowerCase() !== title.toLowerCase() ? publisher : undefined,
    source.date,
    source.note,
  ]
    .filter(Boolean)
    .join(' \u00b7 ');
  return (
    <Receipt
      className="ds-evidence__receipt"
      source={title}
      {...(source.href ? { href: source.href } : {})}
      {...(detail ? { detail } : {})}
      {...(level
        ? {
            /* The grade's definition is one click from every receipt (DESIGN.md section 9.6). */
            grade: (
              <a
                href={METHODOLOGY_EVIDENCE_GRADES_HREF}
                aria-label={`${confidenceTierPhrase(level)}: what the evidence grades mean`}
              >
                <GradeTag level={level} />
              </a>
            ),
          }
        : {})}
      {...(source.archivedUrl
        ? {
            action: (
              <a
                className="ds-evidence__archive"
                href={source.archivedUrl}
                rel="noopener noreferrer"
              >
                Archived copy
                {formatRecordDate(source.archivedAt)
                  ? `, ${formatRecordDate(source.archivedAt)}`
                  : ''}
              </a>
            ),
          }
        : {})}
    />
  );
}

/**
 * Both values and both sources (DESIGN.md section 7.3): the value this record prints with its
 * receipt, then every other value on file with the source it came from. An alternate with no
 * source on file says so; it never borrows the first value's receipt.
 */
function Dispute({ item }: { readonly item: EvidenceItem & { dispute: EvidenceDisputeView } }) {
  const { dispute } = item;
  return (
    <div className="ds-evidence__flag" role="note">
      <strong>Sources disagree.</strong>{' '}
      {dispute.note ?? 'Another source records this differently.'}
      {dispute.alternates.length > 0 ? (
        <ul className="ds-evidence__alternates">
          <li>
            <span className="ds-evidence__value">{dispute.primaryValue}</span>
            {sourceReceipt(item.source)}
          </li>
          {dispute.alternates.map((alternate) => (
            <li key={alternate.value}>
              <span className="ds-evidence__value">
                {alternate.value}
                {alternate.credible ? '' : ' (not independently credible)'}
              </span>
              <Receipt
                className="ds-evidence__receipt"
                source={alternate.source ?? 'Source not on file'}
                {...(alternate.sourceHref ? { href: alternate.sourceHref } : {})}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function EvidenceList({ items }: { readonly items: readonly EvidenceItem[] }) {
  return (
    <ol className="ds-evidence">
      {items.map((item) => (
        <li key={item.id} id={item.id} className="ds-evidence__item">
          {item.statement ? <p className="ds-evidence__statement">{item.statement}</p> : null}
          {sourceReceipt(item.source, item.level)}
          {item.dispute?.hasDispute ? <Dispute item={{ ...item, dispute: item.dispute }} /> : null}
          {item.retraction ? (
            <div className="ds-evidence__flag ds-evidence__flag--retracted" role="note">
              <strong>
                Retracted {formatRecordDate(item.retraction.retractedAt) ?? 'on an unrecorded date'}
                .
              </strong>{' '}
              {item.retraction.reason}
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
