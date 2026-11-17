/**
 * "What the sources say": a numbered evidence list, one entry per statement.
 *
 * Each entry reads in the order a skeptic checks it: the statement, then where it came from
 * (publisher, title, date, link, archived copy), then a quiet grade tag. The grade is a glyph and
 * a word, never color alone and never probability wording. A preserved contradiction or a
 * retraction stays inline under the statement it qualifies.
 *
 * Law and book pages pass sources with no graded statement; the list then numbers the sources
 * themselves, so all five record families cite the same way.
 */
import React, { type ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { ConfidenceLevel } from '@repo/ui';
import { confidenceTierPhrase } from '../../lib/evidence/confidence-language';
import { confidenceIconFor } from '../../lib/map-experience/confidence-icons';
import type { EvidenceDisputeView, EvidenceRetractionNotice } from '../../lib/evidence';
import { sourceDisplayName } from '../../lib/evidence/source-label';
import { formatRecordDate } from '../patterns/format-record-date';
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

function SourceLine({ source }: { readonly source: EvidenceSource }) {
  const publisher = source.publisher && sourceDisplayName(source.publisher, source.href);
  const title = sourceDisplayName(source.title, source.href);
  const showPublisher = publisher && publisher.toLowerCase() !== title.toLowerCase();
  return (
    <p className="ds-evidence__source">
      {showPublisher ? <span className="ds-evidence__publisher">{publisher}</span> : null}
      {source.href ? (
        <a className="ds-evidence__title" href={source.href} rel="noopener noreferrer">
          {title}
        </a>
      ) : (
        <span className="ds-evidence__title">{title}</span>
      )}
      {source.date ? <span className="ds-evidence__date">{source.date}</span> : null}
      {source.archivedUrl ? (
        <a className="ds-evidence__archive" href={source.archivedUrl} rel="noopener noreferrer">
          Archived copy
          {formatRecordDate(source.archivedAt) ? `, ${formatRecordDate(source.archivedAt)}` : ''}
        </a>
      ) : null}
      {source.note ? <span className="ds-evidence__note">{source.note}</span> : null}
    </p>
  );
}

export function EvidenceList({ items }: { readonly items: readonly EvidenceItem[] }) {
  return (
    <ol className="ds-evidence">
      {items.map((item) => (
        <li key={item.id} id={item.id} className="ds-evidence__item">
          {item.statement ? <p className="ds-evidence__statement">{item.statement}</p> : null}
          <SourceLine source={item.source} />
          {item.level ? <GradeTag level={item.level} /> : null}
          {item.dispute?.hasDispute ? (
            <div className="ds-evidence__flag" role="note">
              <strong>Sources disagree.</strong>{' '}
              {item.dispute.note ?? 'Another source records this differently.'}
              {item.dispute.alternates.length > 0 ? (
                <ul className="ds-evidence__alternates">
                  {item.dispute.alternates.map((alternate) => (
                    <li key={alternate.value}>
                      {alternate.value}
                      {alternate.credible ? '' : ' (not independently credible)'}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
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
