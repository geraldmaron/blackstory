/**
 * Record sheet — right slab, z 40. Non-modal on purpose.
 *
 * v6 previewed a record in a modal `<dialog>`, which froze the map behind it. The whole argument
 * of v9 is that the map is the product, so the sheet is `aria-modal="false"`: the plate stays
 * pannable, the camera keeps flying, and the reader can compare the record against its geography
 * without dismissing anything (design-direction-v9-atlas.md §5.6).
 *
 * The anatomy grid is `RecordAnatomyPanel`, unchanged. Rebuilding a second Kind / Where / Era /
 * Evidence grid here would give the archive two record anatomies that could drift apart.
 *
 * The precision note is not optional and not editorial. It is the archive stating what its own
 * pin means, and it renders for every record including ones with a well-known address.
 */
'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { cx } from '@repo/ui';
import {
  RecordAnatomyPanel,
  type RecordAnatomyFact,
  type RecordAnatomyPlace,
} from '../patterns/RecordAnatomyPanel';
import type { ConfidenceTierKey } from '../../lib/map-experience/confidence-icons';
import { KindGlyph } from './KindGlyph';
import './record-sheet.css';

void React;

/** The one sentence the archive owes a reader about any pin it draws. */
export function precisionNote(precision: string): string {
  return `Rendered at ${precision} precision. The archive never draws a point sharper than the source supports.`;
}

export type SheetSource = {
  readonly id: string;
  readonly title: string;
  readonly detail?: string;
  readonly href?: string;
};

export type SheetConnection = {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly mapTone?: string;
  /** Relation slug, shown in mono. "documented at", "founded by". */
  readonly relation: string;
  readonly href?: string;
};

/** One chapter that cites the record. Mirrors `ChapterCitation` without importing the server module. */
export type SheetCitingChapter = {
  readonly slug: string;
  readonly title: string;
  /** Stated in words: "mapped in", "referenced in". */
  readonly relation: string;
  readonly href: string;
};

export type SheetRecord = {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly kindLabel: string;
  readonly mapTone?: string;
  readonly place: string;
  readonly era: string;
  readonly story: string;
  readonly precision: string;
  readonly confidenceTier: ConfidenceTierKey;
  readonly evidenceLabel: string;
  /**
   * How many accepted claims the record actually has, from the map feature's `evidenceCount`.
   *
   * Separate from `sources.length` on purpose: the map payload carries the count but not the
   * citations (it is a tile-scale payload), so the plate knows how many sources a record has
   * without holding any of them. Conflating the two is what made this plate contradict itself,
   * printing "Grade A · 1 source" in the anatomy and "0 sources / none published yet" three
   * rows below on the same record.
   */
  readonly sourceCount?: number;
  /** Where the citations actually live, when the plate is not carrying them. */
  readonly href?: string;
  readonly sources: readonly SheetSource[];
  readonly connections: readonly SheetConnection[];
  /**
   * Chapters that cite this record (SP-20). Optional so every existing caller keeps compiling
   * and simply renders no chapter list; the Atlas and `/entity/[id]` supply it.
   */
  readonly citingChapters?: readonly SheetCitingChapter[];
  readonly anatomyPlace?: RecordAnatomyPlace;
};

export type RecordSheetProps = {
  readonly record: SheetRecord | null;
  readonly onClose: () => void;
  /** Position within the current lens, 1-based. */
  readonly position?: { readonly index: number; readonly total: number };
  readonly onStep?: (direction: 1 | -1) => void;
  readonly onFlyToPlace?: () => void;
  readonly onSave?: () => void;
  readonly saved?: boolean;
  readonly onCite?: () => void;
  readonly onShare?: () => void;
  /** Selects a connected record on the plate instead of navigating away from the Atlas. */
  readonly onSelectConnection?: (entityId: string) => void;
  readonly className?: string;
};

function anatomyFacts(record: SheetRecord): readonly RecordAnatomyFact[] {
  return [
    {
      key: 'kind',
      label: 'Kind',
      value: record.kindLabel,
      icon: {
        variant: 'record-kind',
        kind: record.kind,
        muted: true,
        ...(record.mapTone ? { mapTone: record.mapTone } : {}),
      },
    },
    { key: 'where', label: 'Where', value: record.place, icon: { variant: 'record-where' } },
    { key: 'era', label: 'Era', value: record.era, icon: { variant: 'record-era' } },
    {
      key: 'evidence',
      label: 'Evidence',
      value: record.evidenceLabel,
      icon: { variant: 'record-evidence', tier: record.confidenceTier },
    },
  ];
}

export function RecordSheet({
  record,
  onClose,
  position,
  onStep,
  onFlyToPlace,
  onSave,
  saved = false,
  onCite,
  onShare,
  onSelectConnection,
  className,
}: RecordSheetProps) {
  const sheetRef = useRef<HTMLElement | null>(null);
  const open = record !== null;

  const close = useCallback(() => onClose(), [onClose]);

  /**
   * ESC closes the sheet. It is deliberately not a focus trap: a non-modal sheet that traps focus
   * is a modal that lies about it, and the reader must be able to tab back out to the map.
   */
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Esc') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [close, open]);

  /** Move focus to the sheet when a new record opens, so a keyboard reader lands inside it. */
  useEffect(() => {
    if (open) sheetRef.current?.focus();
  }, [open, record?.id]);

  if (!record) return null;

  /*
   * What is actually on screen wins.
   *
   * `sourceCount` is the map feature's `evidenceCount`: the record's own accepted claims. Once
   * SP-20 started passing real citations, that count stopped describing the list under it, and
   * the sheet printed "2 sources" as the heading hint above six numbered entries. The two
   * numbers count different things (own claims vs. citations backing the record's documented
   * relationships) and both are true, but only one of them is the list the reader is looking at.
   * The count therefore describes the list whenever there is a list, and falls back to the
   * plate's count only when the sheet is carrying no citations at all, which is the case the
   * fallback copy below exists for.
   */
  const sourceCount = record.sources.length > 0 ? record.sources.length : (record.sourceCount ?? 0);
  const citingChapters = record.citingChapters ?? [];

  return (
    <aside
      className={cx('ds-sheet', className)}
      role="dialog"
      aria-modal="false"
      aria-labelledby="ds-sheet-name"
      tabIndex={-1}
      ref={sheetRef}
    >
      <div className="ds-sheet__top">
        <span className="ds-sheet__kicker-label">Record</span>
        <span className="ds-sheet__spacer" />
        {onStep ? (
          <button
            type="button"
            className="ds-sheet__step"
            onClick={() => onStep(-1)}
            aria-label="Previous record"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M10 3.5 5.5 8l4.5 4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
        {position ? (
          <span className="ds-sheet__position">
            {position.index.toLocaleString('en-US')} of {position.total.toLocaleString('en-US')}
          </span>
        ) : null}
        {onStep ? (
          <button
            type="button"
            className="ds-sheet__step"
            onClick={() => onStep(1)}
            aria-label="Next record"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M6 3.5 10.5 8 6 12.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
        <button type="button" className="ds-sheet__close" onClick={close} aria-label="Close record">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3.8 3.8l8.4 8.4m0-8.4-8.4 8.4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="ds-sheet__body">
        <div>
          <p className="ds-sheet__kicker">
            <KindGlyph
              kind={record.kind}
              {...(record.mapTone ? { mapTone: record.mapTone } : {})}
              size={12}
            />
            <span>{record.kindLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{record.place}</span>
            <span aria-hidden="true">·</span>
            <span>{record.era}</span>
          </p>
          {/*
           * The name is the way out of the sheet and onto the record. A reader who clicks a pin
           * is asking about that entity, and the sheet is a preview of it — without a link on the
           * thing they clicked, the only route to the page was a conditional line buried under
           * Sources, which does not render at all when the sheet already carries citations.
           */}
          <h2 className="ds-sheet__name" id="ds-sheet-name">
            {record.href ? (
              <a className="ds-sheet__name-link" href={record.href}>
                {record.name}
              </a>
            ) : (
              record.name
            )}
          </h2>
        </div>

        {record.story ? <p className="ds-sheet__story">{record.story}</p> : null}

        <RecordAnatomyPanel
          className="ds-sheet__anatomy"
          facts={anatomyFacts(record)}
          {...(record.anatomyPlace ? { place: record.anatomyPlace } : {})}
          aria-label={`Anatomy of ${record.name}`}
        />

        <p className="ds-sheet__precision">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.3" />
            <path
              d="M8 7.2v4M8 4.9v.9"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          <span>{precisionNote(record.precision)}</span>
        </p>

        <div className="ds-sheet__actions">
          {/*
           * Opening the record is the primary action, and it takes the one filled slot the accent
           * hierarchy allows (§8) — so `Fly to place`, which keeps the reader where they already
           * are, drops to the plain treatment.
           */}
          {record.href ? (
            <a className="ds-sheet__action ds-sheet__action--primary" href={record.href}>
              Open record
            </a>
          ) : null}
          {onFlyToPlace ? (
            <button
              type="button"
              className={
                record.href ? 'ds-sheet__action' : 'ds-sheet__action ds-sheet__action--primary'
              }
              onClick={onFlyToPlace}
            >
              Fly to place
            </button>
          ) : null}
          {onSave ? (
            <button
              type="button"
              className="ds-sheet__action"
              onClick={onSave}
              aria-pressed={saved}
            >
              {saved ? 'Saved' : 'Save'}
            </button>
          ) : null}
          {onCite ? (
            <button type="button" className="ds-sheet__action" onClick={onCite}>
              Cite
            </button>
          ) : null}
          {onShare ? (
            <button type="button" className="ds-sheet__action" onClick={onShare}>
              Share
            </button>
          ) : null}
        </div>

        <section className="ds-sheet__group">
          <h3 className="ds-sheet__group-label">
            Sources
            <span className="ds-sheet__group-hint">
              {sourceCount === 1 ? '1 source' : `${sourceCount} sources`}
            </span>
          </h3>
          {record.sources.length === 0 ? (
            /*
             * Two different silences, and saying the wrong one is a published falsehood. A record
             * with accepted claims HAS sources; the plate just does not carry them, because the
             * map payload is a count and a confidence tier, not a bibliography. Telling that
             * reader "no sources are published" is false about a record whose page cites one.
             */
            sourceCount > 0 ? (
              <p className="ds-sheet__empty">
                {sourceCount === 1
                  ? 'This record cites one source. '
                  : `This record cites ${sourceCount} sources. `}
                {record.href ? (
                  <a href={record.href}>Open the record to read the citations.</a>
                ) : (
                  'Open the record to read the citations.'
                )}
              </p>
            ) : (
              <p className="ds-sheet__empty">
                No sources are published for this record yet. It is listed because a documented
                reference exists, and the citation will appear here when it clears review.
              </p>
            )
          ) : (
            <ol className="ds-sheet__sources">
              {record.sources.map((source, index) => (
                <li key={source.id} className="ds-sheet__source">
                  <span className="ds-sheet__source-index" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className="ds-sheet__source-text">
                    {source.href ? (
                      <a href={source.href} rel="noreferrer">
                        {source.title}
                      </a>
                    ) : (
                      source.title
                    )}
                    {source.detail ? (
                      <span className="ds-sheet__source-detail">{source.detail}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {record.connections.length > 0 ? (
          <section className="ds-sheet__group">
            <h3 className="ds-sheet__group-label">Documented connections</h3>
            <ul className="ds-sheet__connections">
              {record.connections.map((connection) => (
                <li key={connection.id} className="ds-sheet__connection">
                  <KindGlyph
                    kind={connection.kind}
                    {...(connection.mapTone ? { mapTone: connection.mapTone } : {})}
                    size={12}
                  />
                  {connection.href ? (
                    /*
                     * A real anchor even when selecting in place is the primary action: the
                     * connected record HAS a page, and a reader who middle-clicks or copies the
                     * link should get it. The click handler intercepts the plain left-click only,
                     * because staying on the Atlas and flying to the neighbour is the better
                     * answer for the reader who is comparing two pins.
                     */
                    <a
                      href={connection.href}
                      onClick={
                        onSelectConnection
                          ? (event) => {
                              if (
                                event.defaultPrevented ||
                                event.metaKey ||
                                event.ctrlKey ||
                                event.shiftKey ||
                                event.altKey ||
                                event.button !== 0
                              ) {
                                return;
                              }
                              event.preventDefault();
                              onSelectConnection(connection.id);
                            }
                          : undefined
                      }
                    >
                      {connection.name}
                    </a>
                  ) : onSelectConnection ? (
                    <button
                      type="button"
                      className="ds-sheet__connection-select"
                      onClick={() => onSelectConnection(connection.id)}
                    >
                      {connection.name}
                    </button>
                  ) : (
                    <span>{connection.name}</span>
                  )}
                  <span className="ds-sheet__relation">{connection.relation}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/*
         * The record side of the thesis: every record links back to the writing about it. Renders
         * only when a chapter actually cites this record — an empty "Chapters that cite this
         * record" heading on most of the catalog would read as a gap in the archive rather than
         * as the ordinary state of a record no chapter has reached yet.
         */}
        {citingChapters.length > 0 ? (
          <section className="ds-sheet__group">
            <h3 className="ds-sheet__group-label">
              Chapters that cite this record
              <span className="ds-sheet__group-hint">
                {citingChapters.length === 1 ? '1 chapter' : `${citingChapters.length} chapters`}
              </span>
            </h3>
            <ul className="ds-sheet__connections ds-sheet__chapters">
              {citingChapters.map((chapter) => (
                <li key={chapter.slug} className="ds-sheet__connection">
                  <a href={chapter.href}>{chapter.title}</a>
                  <span className="ds-sheet__relation">{chapter.relation}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </aside>
  );
}
