/**
 * A challenged book on the shared record anatomy. The cover is the media; the description is the
 * lede; the challenges (state, district, school year, status, source) are the body beat a reader
 * checks, then the cited reports as a numbered source list.
 *
 * States are the true precision of a challenge report: the page never says a book was pulled
 * from every school in a state. Related titles are only those by the same author; sharing a
 * challenge state is collection membership, not a connection.
 */
import React from 'react';
import Link from 'next/link';
import { faBook, faCalendar, faPenNib } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  formatRecordDate,
  RecordBeat,
  RecordConnections,
  RecordPage,
  type RecordFact,
  type RecordFileRow,
  type RecordMetaItem,
} from '../../../components/patterns/RecordPage';
import { EvidenceList, type EvidenceItem } from '../../../components/evidence/EvidenceList';
import { METHODOLOGY_HOW_RECORD_GETS_IN_HREF } from '../../../components/evidence/editorial-links';
import {
  activeBookChallenges,
  type BooksBrowseItem,
  type BooksDetailViewModel,
} from '../books-view-model';
import { BooksCoverArt } from '../BooksCoverArt';
import { coverIsbnForBook } from '../books-cover';
import { BOOKS_DETAIL } from '../books-copy';

void React;

const STATUS_WORDS: Readonly<Record<string, string>> = {
  reported: 'Reported',
  banned: 'Banned',
  restricted: 'Restricted',
  unknown: 'Not stated',
};

/** The archive record this book is filed under, when it resolves to one. */
export type BookArchiveRecord = {
  readonly href: string;
  readonly name: string;
  /** `/explore?selected=…` when the record has a public point. */
  readonly mapHref?: string;
};

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

type DatedChallenge = { readonly challengeYear?: number; readonly schoolYear?: string };

/**
 * The When cell, never sharper than the reports: a stored school year is shown as stored
 * ("2022-2023"), several as the span from the first to the last; a bare year only when that is
 * all a report carries.
 */
export function challengeWhen(challenges: readonly DatedChallenge[]): RecordFact {
  const schoolYears = [
    ...new Set(challenges.map((c) => c.schoolYear?.trim()).filter((y): y is string => !!y)),
  ].sort();
  if (schoolYears.length === 1) {
    return { label: 'When', value: schoolYears[0]!, detail: 'Challenge school year' };
  }
  if (schoolYears.length > 1) {
    const start = /\d{4}/.exec(schoolYears[0]!)?.[0] ?? schoolYears[0]!;
    const end = /(\d{4})\D*$/.exec(schoolYears.at(-1)!)?.[1] ?? schoolYears.at(-1)!;
    return { label: 'When', value: `${start} to ${end}`, detail: 'Challenge school years' };
  }
  const years = [
    ...new Set(challenges.map((c) => c.challengeYear).filter((y): y is number => y !== undefined)),
  ].sort((a, b) => a - b);
  if (years.length === 0) return { label: 'When', value: 'Not dated yet' };
  if (years.length === 1)
    return { label: 'When', value: String(years[0]), detail: 'Challenge year' };
  return {
    label: 'When',
    value: `${years[0]} to ${years.at(-1)}`,
    detail: 'Challenge years',
  };
}

/** "2022-2023" as "2022–23": a school year set as one numeral, so it cannot read as a date. */
function shortSchoolYear(schoolYear: string): string {
  const match = /^(\d{4})\D+(\d{2,4})$/.exec(schoolYear.trim());
  return match ? `${match[1]}–${match[2]!.slice(-2)}` : schoolYear.trim();
}

/**
 * The display numeral beside the title, captioned: next to the publication year in the meta
 * line, a bare challenge year would read as a date about the book.
 */
export function challengeNumeral(
  challenges: readonly DatedChallenge[],
): { value: string; caption: string } | undefined {
  const schoolYears = [
    ...new Set(challenges.map((c) => c.schoolYear?.trim()).filter((y): y is string => !!y)),
  ].sort();
  if (schoolYears.length > 0) {
    return {
      value: shortSchoolYear(schoolYears[0]!),
      caption: schoolYears.length === 1 ? 'Challenge school year' : 'First challenge on file',
    };
  }
  const years = challenges
    .map((c) => c.challengeYear)
    .filter((y): y is number => y !== undefined)
    .sort((a, b) => a - b);
  if (years.length === 0) return undefined;
  return {
    value: String(years[0]),
    caption: new Set(years).size === 1 ? 'Challenge year' : 'First challenge on file',
  };
}

export function BookRecordView({
  view,
  related,
  archiveRecord,
  hasCover = true,
}: {
  readonly view: Extract<BooksDetailViewModel, { readonly kind: 'ok' }>;
  readonly related: readonly BooksBrowseItem[];
  readonly archiveRecord?: BookArchiveRecord;
  /** False when the server found no cover upstream, so the page does not request one. */
  readonly hasCover?: boolean;
}) {
  const { book, states } = view;
  const challenges = activeBookChallenges(book);
  const authors = book.authors.map((author) => author.name);
  const published = /^\d{4}/.exec(book.publishedDate)?.[0];
  const coverIsbn = coverIsbnForBook(book);
  const numeral = challengeNumeral(challenges);
  const bookshop = book.purchaseLinks.find((link) => link.retailer === 'bookshop');
  const lookups = book.purchaseLinks.filter((link) => link.retailer !== 'bookshop');
  const isbn = book.identifiers.find((id) => id.system === 'isbn-13' || id.system === 'isbn-10');
  const stateName = (code: string) => states.find((entry) => entry.code === code)?.name ?? code;

  const meta: RecordMetaItem[] = [
    { label: 'Book', icon: faBook },
    ...(authors.length > 0 ? [{ label: authors.join(', '), icon: faPenNib }] : []),
    ...(published ? [{ label: published, icon: faCalendar }] : []),
  ];

  const sources: EvidenceItem[] = book.citations.map((citation, index) => {
    const date = formatRecordDate(citation.publishedAt);
    return {
      id: `source-${index + 1}`,
      source: {
        ...(citation.publisher ? { publisher: citation.publisher } : {}),
        title: citation.label,
        href: citation.href,
        ...(date ? { date } : {}),
      },
    };
  });

  const retrieved = formatRecordDate(book.provenance.retrievedAt);
  const file: RecordFileRow[] = [
    ...(retrieved ? [{ label: 'Listing retrieved', value: <time>{retrieved}</time> }] : []),
    {
      label: 'Listing source',
      value: (
        <a href={book.provenance.sourceUrl} rel="noopener noreferrer">
          {book.provenance.source}
        </a>
      ),
    },
    ...(isbn ? [{ label: 'ISBN', value: <span className="ds-mono">{isbn.value}</span> }] : []),
    ...(lookups.length > 0
      ? [
          {
            label: 'Look it up',
            value: (
              <ul className="ds-recpage__plain-list">
                {lookups.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} rel="noopener noreferrer">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            ),
          },
        ]
      : []),
    {
      label: 'Method',
      value: (
        <Link href={METHODOLOGY_HOW_RECORD_GETS_IN_HREF} prefetch={false}>
          How entries are checked against their sources
        </Link>
      ),
    },
  ];

  const connections = [
    ...(archiveRecord
      ? [
          {
            href: archiveRecord.href,
            name: archiveRecord.name,
            relation: 'archive record for this title',
          },
        ]
      : []),
    ...related.map((item) => ({
      href: `/books/${item.slug}`,
      name: item.title,
      relation: `also by ${item.authorNames}`,
      kind: 'Book',
    })),
  ];

  return (
    <RecordPage
      crumb={{ href: '/books', label: 'Books' }}
      title={book.title}
      meta={meta}
      ledeText={book.description}
      facts={[
        {
          label: 'Where',
          value:
            states.length > 0
              ? `Challenged in ${plural(states.length, 'state')}`
              : 'No state on file',
          ...(states.length > 0 ? { detail: states.map((state) => state.name).join(', ') } : {}),
        },
        challengeWhen(challenges),
        {
          label: 'Evidence',
          value: (
            <a className="ds-recpage__grade" href="#sources">
              <FontAwesomeIcon icon={faBook} className="ds-recpage__icon" aria-hidden="true" />
              {plural(book.citations.length, 'source')}
            </a>
          ),
          detail: `${plural(challenges.length, 'challenge report')}`,
        },
      ]}
      {...(numeral ? { numeral } : {})}
      {...(coverIsbn
        ? {
            media: (
              <BooksCoverArt
                title={book.title}
                {...(hasCover ? { isbn: coverIsbn } : {})}
                author={authors.join(', ')}
                size="L"
                decorative={false}
                className="ds-recpage__cover"
              />
            ),
          }
        : {})}
      actions={{
        ...(archiveRecord?.mapHref ? { map: { href: archiveRecord.mapHref } } : {}),
        ...(bookshop
          ? {
              extra: {
                href: bookshop.href,
                label: 'Buy on Bookshop',
                rel: 'noopener noreferrer sponsored',
                note: BOOKS_DETAIL.affiliateNotice,
              },
            }
          : {}),
        correctionHref: `/corrections?target=${encodeURIComponent(book.id)}`,
      }}
      sourcesAnchor="sources"
      file={file}
    >
      {challenges.length > 0 ? (
        <RecordBeat id="challenges" title="Challenges">
          <div className="ds-recpage__table-wrap">
            <table className="ds-recpage__table">
              <thead>
                <tr>
                  <th scope="col">State</th>
                  <th scope="col">District</th>
                  <th scope="col">School year</th>
                  <th scope="col">Status</th>
                  <th scope="col">Source</th>
                </tr>
              </thead>
              <tbody>
                {challenges.map((challenge, index) => (
                  <tr key={`${challenge.state}-${index}`}>
                    <td className="ds-recpage__cell--state">
                      <Link
                        href={`/books?state=${encodeURIComponent(challenge.state)}`}
                        prefetch={false}
                      >
                        {stateName(challenge.state)}
                      </Link>
                    </td>
                    <td className="ds-recpage__cell--district">
                      {challenge.jurisdictionLabel ?? 'District not stated'}
                    </td>
                    <td className="ds-recpage__cell--year">
                      {challenge.schoolYear ?? challenge.challengeYear ?? 'Not stated'}
                    </td>
                    <td className="ds-recpage__cell--status">
                      {STATUS_WORDS[challenge.status] ?? 'Not stated'}
                    </td>
                    <td className="ds-recpage__cell--source">
                      <a href={challenge.citation.href} rel="noopener noreferrer">
                        {challenge.citation.publisher ?? challenge.citation.label}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="ds-recpage__aside">{BOOKS_DETAIL.challengesLede}</p>
        </RecordBeat>
      ) : null}

      <RecordBeat id="sources" title="What the sources say">
        <EvidenceList items={sources} />
      </RecordBeat>

      {connections.length > 0 ? (
        <RecordBeat id="connections" title="Connected records">
          <RecordConnections connections={connections} />
        </RecordBeat>
      ) : null}
    </RecordPage>
  );
}
