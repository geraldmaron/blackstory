/**
 * The record page: one anatomy for every record family (entity, place, invention, law, book),
 * specified by docs/ui/DESIGN.md section 9.1.
 *
 * Families pass data, never layout. One square paper sheet holds, in reading order:
 *   1. crumb, the name in display type, the year numeral and one meta line
 *   2. the lede, clamped past about 70 words with the full text kept in the HTML
 *   3. the side column: the record at a glance (Where, When, Evidence), one of each action
 *      (Cite among them), the lead exhibit and, when the lead is not itself the map, the map
 *      exhibit on ink
 *   4. body beats (`RecordBeat`), in the order the family passes them
 *   5. the record file footer
 * and under the sheet a prev/next pager, only when the reader arrived from a list.
 *
 * Desktop: the side column stands beside the reading, so the exhibits sit beside the claims.
 * Phone and tablet: one column in the order exhibit, name, summary, facts, the first beat (an
 * entity's claims), map, the other beats; the actions pin as a bottom row. Everything renders on
 * the server. A `quiet` record (violence-adjacent or sensitive) passes quiet exhibits.
 */
import React, { type ReactNode } from 'react';
import Link from 'next/link';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faArrowRight,
  faArrowUpRightFromSquare,
  faDiamondTurnRight,
  faMapLocationDot,
  faPenToSquare,
  faQuoteLeft,
} from '@fortawesome/free-solid-svg-icons';
import { buttonClassName, DisplayNumeral, SectionHeading, Sheet } from '@repo/ui';
import { RecordCite, type RecordCiteSource } from './RecordCite';
import '../../app/record-page.css';

void React;

/** Past this many words the lede is clamped behind "Read full summary". */
export const LEDE_CLAMP_WORDS = 70;

export type RecordLink = { readonly href: string; readonly label: string };

/** One meta-line item: a word and its glyph. Items wrap whole, so no separator can dangle. */
export type RecordMetaItem = {
  readonly label: string;
  readonly icon: IconDefinition;
};

export type RecordFact = {
  readonly label: 'Where' | 'When' | 'Evidence';
  readonly value: ReactNode;
  readonly detail?: ReactNode;
};

export type RecordActions = {
  /**
   * The in-app map hand-off. Absent when the record has no map destination. `label` says exactly
   * what the link opens when that is not this record itself (a law opens records of its era).
   */
  readonly map?: { readonly href: string; readonly label?: string };
  /** "Open in maps": only for a visitable record at site precision. */
  readonly externalMapsHref?: string;
  /**
   * A quiet extra link a family owns (the book's affiliate link), with the one sentence that
   * discloses it directly beneath. It stays out of the phone's sticky action row.
   */
  readonly extra?: {
    readonly href: string;
    readonly label: string;
    readonly rel?: string;
    readonly note?: string;
  };
  readonly correctionHref: string;
  /** What the Cite control cites: this page, at its canonical URL. */
  readonly cite?: RecordCiteSource;
};

export type RecordFileRow = { readonly label: string; readonly value: ReactNode };

export type RecordPagerProps = {
  readonly label: string;
  readonly position?: string;
  readonly previous?: RecordLink;
  readonly next?: RecordLink;
};

export type RecordPageProps = {
  readonly crumb: RecordLink;
  readonly title: string;
  readonly meta: readonly RecordMetaItem[];
  /** Plain text of the lede, used to decide the clamp. */
  readonly ledeText: string;
  /** The rendered lede; defaults to `ledeText`. */
  readonly lede?: ReactNode;
  /** A one-line content note under the lede (sensitivity, legal disclaimer). */
  readonly note?: ReactNode;
  /** Topic pills under the lede, each a link into the filtered records list. */
  readonly tags?: readonly RecordLink[];
  readonly facts: readonly RecordFact[];
  /**
   * The display numeral, when the When fact's first year would read as the wrong kind of date
   * (a book's challenge school year beside its publication year): the value and a caption that
   * names what it is. Defaults to `recordNumeral(facts)` with no caption.
   */
  readonly numeral?: { readonly value: string; readonly caption: string };
  /**
   * The lead exhibit: the record's photograph, else a source document image, else the map
   * (DESIGN.md section 9.1). A book passes its cover.
   */
  readonly lead?: ReactNode;
  /** The map exhibit on ink, when the lead is something else. */
  readonly map?: ReactNode;
  readonly actions: RecordActions;
  /** Anchor of the "What the sources say" beat, for the phone's Sources action. */
  readonly sourcesAnchor?: string;
  readonly children: ReactNode;
  readonly file: readonly RecordFileRow[];
  readonly pager?: RecordPagerProps;
  /** A violence-adjacent or sensitive record: its exhibits are the quiet variant. */
  readonly quiet?: boolean;
};

export { formatRecordDate } from './format-record-date';

/**
 * The display numeral beside the title, and what it must say so it never says less than the When
 * fact: the first year or decade it states, captioned with the end of a range ("to 1940s" for
 * "1670s to 1940s", "to 2023" for "2022-2023", "to present") and "circa" when the date is
 * approximate. Nothing when the record is undated. It repeats the citation line, so it is
 * decorative.
 */
export function recordNumeral(
  facts: readonly RecordFact[],
): { readonly value: string; readonly caption?: string } | undefined {
  const when = facts.find((fact) => fact.label === 'When')?.value;
  if (typeof when !== 'string') return undefined;
  const years = [...when.matchAll(/\b\d{4}s?\b/g)].map((match) => match[0]);
  const first = years[0];
  if (first === undefined) return undefined;
  const last = years.at(-1);
  const end =
    last !== undefined && last !== first ? last : /\bpresent\b/i.test(when) ? 'present' : undefined;
  const circa = /\b(?:circa|ca\.|c\.)\s*\d/i.test(when) || /\bcirca\b/i.test(when);
  const caption = [circa ? 'circa' : undefined, end ? `to ${end}` : undefined]
    .filter((part): part is string => part !== undefined)
    .join(', ');
  return caption ? { value: first, caption } : { value: first };
}

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

function Icon({ icon }: { readonly icon: IconDefinition }) {
  return <FontAwesomeIcon icon={icon} className="ds-recpage__icon" aria-hidden="true" />;
}

function RecordLede({
  text,
  children,
  tags,
}: {
  readonly text: string;
  readonly children: ReactNode;
  readonly tags?: readonly RecordLink[];
}) {
  if (text.trim().length === 0) return null;
  const clamp = wordCount(text) > LEDE_CLAMP_WORDS;
  return (
    <div className="ds-recpage__lede" {...(clamp ? { 'data-clamp': '' } : {})}>
      {clamp ? (
        <input
          type="checkbox"
          id="record-lede-more"
          className="ds-recpage__lede-toggle ds-visually-hidden"
        />
      ) : null}
      <p className="ds-recpage__lede-text">{children}</p>
      {clamp ? (
        <label htmlFor="record-lede-more" className="ds-recpage__lede-more">
          <span className="ds-recpage__lede-open">Read full summary</span>
          <span className="ds-recpage__lede-close">Show less</span>
        </label>
      ) : null}
      {tags && tags.length > 0 ? (
        <ul className="ds-recpage__pills ds-recpage__tags" aria-label="Topics">
          {tags.map((tag) => (
            <li key={tag.href}>
              <Link
                className="ds-recpage__pill ds-recpage__pill--link"
                href={tag.href}
                prefetch={false}
              >
                {tag.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** One body section: a plain h2 on the text edge, then its content. */
export function RecordBeat({
  id,
  title,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly children: ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <section className="ds-recpage__beat" id={id} aria-labelledby={headingId}>
      <SectionHeading id={headingId}>{title}</SectionHeading>
      {children}
    </section>
  );
}

/** Prose paragraphs split on blank lines, in the record's reading register. */
export function RecordProse({ children }: { readonly children: ReactNode }) {
  return <div className="ds-recpage__prose">{children}</div>;
}

export type RecordConnection = {
  readonly href: string;
  readonly name: string;
  /** How the two records relate, in words. Empty only for a plain outside link (a law's agency). */
  readonly relation: string;
  readonly kind?: string;
  /** An outside site: underlined, marked with an arrow, never prefetched. */
  readonly external?: boolean;
};

/**
 * Ruled two-line rows (name, then relation); the whole row is the link. Used for typed
 * connections, the stories that cite a record and a law's agencies. Nearness or shared membership
 * never qualifies as a connection.
 */
export function RecordConnections({
  connections,
}: {
  readonly connections: readonly RecordConnection[];
}) {
  return (
    <ul className="ds-recpage__links">
      {connections.map((connection) => {
        const relation = [connection.kind, connection.relation].filter(Boolean).join(' · ');
        return (
          <li key={`${connection.href}|${connection.name}`} className="ds-recpage__link-row">
            {connection.external ? (
              <a
                className="ds-recpage__link-name ds-recpage__link-name--external"
                href={connection.href}
                rel="noopener noreferrer"
              >
                {connection.name}
                <Icon icon={faArrowUpRightFromSquare} />
              </a>
            ) : (
              <Link className="ds-recpage__link-name" href={connection.href} prefetch={false}>
                {connection.name}
              </Link>
            )}
            {relation ? <span className="ds-recpage__link-relation">{relation}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

function RecordPager({ label, position, previous, next }: RecordPagerProps) {
  if (!previous && !next) return null;
  return (
    <nav className="ds-recpage__pager" aria-label={label}>
      {previous ? (
        <Link
          className="ds-recpage__step"
          href={previous.href}
          rel="prev"
          prefetch={false}
          data-ground="ink"
        >
          <span className="ds-recpage__step-dir">
            <Icon icon={faArrowLeft} />
            Previous
          </span>
          <span className="ds-recpage__step-name">{previous.label}</span>
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
      <span className="ds-recpage__position">{position}</span>
      {next ? (
        <Link
          className="ds-recpage__step ds-recpage__step--next"
          href={next.href}
          rel="next"
          prefetch={false}
          data-ground="ink"
        >
          <span className="ds-recpage__step-dir">
            Next
            <Icon icon={faArrowRight} />
          </span>
          <span className="ds-recpage__step-name">{next.label}</span>
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
    </nav>
  );
}

export function RecordPage({
  crumb,
  title,
  meta,
  ledeText,
  lede,
  note,
  tags,
  facts,
  numeral: numeralOverride,
  lead,
  map,
  actions,
  sourcesAnchor,
  children,
  file,
  pager,
  quiet = false,
}: RecordPageProps) {
  const numeral = numeralOverride ?? recordNumeral(facts);
  return (
    <main className="ds-doc ds-recpage" id="main" data-quiet={quiet ? '' : undefined}>
      <article className="ds-recpage__record ds-wrap" aria-labelledby="record-title">
        <Sheet className="ds-recpage__grid">
          {/* Name to body. On a desktop this is the two-column grid, the side column starting
              beside the name; elsewhere it and the side column are `display: contents`, so their
              children take the sheet's own order. */}
          <div className="ds-recpage__main">
            <header className="ds-recpage__head">
              {numeral?.caption ? (
                <div
                  className="ds-recpage__numeral ds-recpage__numeral--captioned"
                  aria-hidden="true"
                >
                  <DisplayNumeral tone="soft">{numeral.value}</DisplayNumeral>
                  <span className="ds-recpage__numeral-caption">{numeral.caption}</span>
                </div>
              ) : numeral ? (
                <DisplayNumeral className="ds-recpage__numeral" tone="soft" decorative>
                  {numeral.value}
                </DisplayNumeral>
              ) : null}
              <Link className="ds-recpage__crumb" href={crumb.href} prefetch={false}>
                <Icon icon={faArrowLeft} />
                {crumb.label}
              </Link>
              <h1 id="record-title" className="ds-recpage__title">
                {title}
              </h1>
              {meta.length > 0 ? (
                <ul className="ds-recpage__meta">
                  {meta.map((item) => (
                    <li key={item.label} className="ds-recpage__meta-item">
                      <Icon icon={item.icon} />
                      {item.label}
                    </li>
                  ))}
                </ul>
              ) : null}
            </header>

            <RecordLede text={ledeText} {...(tags ? { tags } : {})}>
              {lede ?? ledeText}
            </RecordLede>
            {note ? <div className="ds-recpage__note">{note}</div> : null}

            <div className="ds-recpage__side">
              <dl className="ds-recpage__facts" aria-label="Record at a glance">
                {facts.map((fact) => (
                  <div key={fact.label} className="ds-recpage__fact">
                    <dt className="ds-recpage__fact-label">{fact.label}</dt>
                    <dd className="ds-recpage__fact-value">{fact.value}</dd>
                    {fact.detail ? (
                      <dd className="ds-recpage__fact-detail">{fact.detail}</dd>
                    ) : null}
                  </div>
                ))}
              </dl>

              <nav className="ds-recpage__actions" aria-label="Record actions">
                {actions.map ? (
                  <Link
                    className={buttonClassName('secondary', 'ds-recpage__action')}
                    href={actions.map.href}
                    prefetch={false}
                  >
                    <Icon icon={faMapLocationDot} />
                    {actions.map.label ?? 'Open on the map'}
                  </Link>
                ) : null}
                {sourcesAnchor ? (
                  <a
                    className={buttonClassName(
                      'secondary',
                      'ds-recpage__action ds-recpage__phone-only',
                    )}
                    href={`#${sourcesAnchor}`}
                  >
                    <Icon icon={faQuoteLeft} />
                    Sources
                  </a>
                ) : null}
                {actions.cite ? (
                  <RecordCite {...actions.cite} accessed={new Date().toISOString()} />
                ) : null}
                {actions.externalMapsHref ? (
                  <a
                    className={buttonClassName(
                      'quiet',
                      'ds-recpage__action ds-recpage__action--icon',
                    )}
                    href={actions.externalMapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon icon={faDiamondTurnRight} />
                    <span className="ds-recpage__action-label">Open in maps</span>
                  </a>
                ) : null}
                <Link
                  className={buttonClassName(
                    'quiet',
                    'ds-recpage__action ds-recpage__action--icon',
                  )}
                  href={actions.correctionHref}
                  prefetch={false}
                >
                  <Icon icon={faPenToSquare} />
                  <span className="ds-recpage__action-label">Suggest a correction</span>
                </Link>
              </nav>

              {lead ? <div className="ds-recpage__lead">{lead}</div> : null}
              {map ? <div className="ds-recpage__map">{map}</div> : null}
              {actions.extra ? (
                <div className="ds-recpage__extra">
                  <a
                    className={buttonClassName('quiet', 'ds-recpage__action')}
                    href={actions.extra.href}
                    target="_blank"
                    rel={actions.extra.rel ?? 'noopener noreferrer'}
                  >
                    {actions.extra.label}
                    <Icon icon={faArrowUpRightFromSquare} />
                  </a>
                  {actions.extra.note ? (
                    <p className="ds-recpage__extra-note">{actions.extra.note}</p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="ds-recpage__body">{children}</div>
          </div>

          <footer className="ds-recpage__file" aria-labelledby="record-file-title">
            <h2 id="record-file-title" className="ds-recpage__file-title">
              Record file
            </h2>
            <dl className="ds-recpage__file-rows">
              {file.map((row) => (
                <div key={row.label} className="ds-recpage__file-row">
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </footer>
        </Sheet>
      </article>

      {pager ? (
        <div className="ds-wrap">
          <RecordPager {...pager} />
        </div>
      ) : null}
    </main>
  );
}
