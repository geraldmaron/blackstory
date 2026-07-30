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
  readonly sources: readonly SheetSource[];
  readonly connections: readonly SheetConnection[];
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
          <h2 className="ds-sheet__name" id="ds-sheet-name">
            {record.name}
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
          {onFlyToPlace ? (
            <button
              type="button"
              className="ds-sheet__action ds-sheet__action--primary"
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
              {record.sources.length === 1 ? '1 source' : `${record.sources.length} sources`}
            </span>
          </h3>
          {record.sources.length === 0 ? (
            <p className="ds-sheet__empty">
              No sources are published for this record yet. It is listed because a documented
              reference exists, and the citation will appear here when it clears review.
            </p>
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
                    <a href={connection.href}>{connection.name}</a>
                  ) : (
                    <span>{connection.name}</span>
                  )}
                  <span className="ds-sheet__relation">{connection.relation}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </aside>
  );
}
