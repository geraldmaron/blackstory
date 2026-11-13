/**
 * The record inspector: what a selection opens, on home and /explore alike. Non-modal on purpose:
 * the map stays pannable behind it, so a reader can compare the record against its geography
 * without dismissing anything.
 *
 * It is an inspector, not a miniature record page. Kind and place, the name, a two-line summary,
 * where the archive can place it in words, the evidence signal, one way onto the record, and a
 * quiet previous/next through the current list. Sources, connections and the visit block live on
 * the record page, one click away.
 *
 * The precision line is not optional and not editorial: it is the archive stating what its own
 * mark means, and it renders for every record.
 */
'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { cx } from '@repo/ui';
import type { ConfidenceTierKey } from '../../lib/map-experience/confidence-icons';
import {
  evidenceCountPhrase,
  evidenceGradeWord,
  gradeDescription,
  gradeForConfidence,
  meterLevelForTier,
} from '../../lib/map-experience/evidence-grade';
import { precisionInWords } from '../../lib/map-experience/geo-precision';
import { placeDetail } from '../../lib/map-experience/place-label';
import { kindLabelForMark } from '../entity/record-mark';
import { RecordMeter } from '../entity/RecordChrome';
import { KindGlyph } from './KindGlyph';
import './record-sheet.css';

void React;

export type SheetRecord = {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly mapTone?: string;
  readonly place: string;
  readonly story: string;
  /** Stored public precision (`ExploreMapFeatureProperties.precision`). */
  readonly precision: string;
  readonly confidenceTier: ConfidenceTierKey;
  /** "Grade A · 2 sources". */
  readonly evidenceLabel: string;
  readonly href?: string;
};

export type RecordSheetProps = {
  readonly record: SheetRecord | null;
  readonly onClose: () => void;
  /** Position within the current list, 1-based. */
  readonly position?: { readonly index: number; readonly total: number };
  readonly onStep?: (direction: 1 | -1) => void;
  readonly className?: string;
};

function StepIcon({ direction }: { readonly direction: 1 | -1 }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d={direction === -1 ? 'M10 3.5 5.5 8l4.5 4.5' : 'M6 3.5 10.5 8 6 12.5'}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RecordSheet({ record, onClose, position, onStep, className }: RecordSheetProps) {
  const sheetRef = useRef<HTMLElement | null>(null);
  const open = record !== null;

  const close = useCallback(() => onClose(), [onClose]);

  /**
   * ESC closes the inspector. It is deliberately not a focus trap: a non-modal panel that traps
   * focus is a modal that lies about it, and the reader must be able to tab back out to the map.
   */
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Esc') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [close, open]);

  /** Move focus to the inspector when a new record opens, so a keyboard reader lands inside it. */
  useEffect(() => {
    if (open) sheetRef.current?.focus();
  }, [open, record?.id]);

  if (!record) return null;

  const kind = kindLabelForMark(record.kind) ?? 'Record';
  const place = placeDetail(record.name, record.place);
  const count = evidenceCountPhrase(record.evidenceLabel);

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
        <p className="ds-sheet__meta">
          <KindGlyph
            kind={record.kind}
            {...(record.mapTone ? { mapTone: record.mapTone } : {})}
            size={12}
          />
          <span>
            {kind}
            {place ? <> · {place}</> : null}
          </span>
        </p>
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
        <h2 className="ds-sheet__name" id="ds-sheet-name">
          {record.name}
        </h2>
        {record.story ? <p className="ds-sheet__summary">{record.story}</p> : null}

        <dl className="ds-sheet__facts">
          <div className="ds-sheet__fact">
            <dt className="ds-visually-hidden">Location precision</dt>
            <dd>{precisionInWords(record.precision)}</dd>
          </div>
          <div className="ds-sheet__fact">
            <dt className="ds-visually-hidden">Evidence</dt>
            <dd className="ds-sheet__evidence">
              <RecordMeter
                level={meterLevelForTier(record.confidenceTier)}
                tone={record.confidenceTier}
                label={gradeDescription(gradeForConfidence(record.confidenceTier))}
              />
              <span className="ds-sheet__grade">{evidenceGradeWord(record.evidenceLabel)}</span>
              {count ? <span className="ds-sheet__count">{count}</span> : null}
            </dd>
          </div>
        </dl>

        <div className="ds-sheet__actions">
          {record.href ? (
            <a className="ds-sheet__open" href={record.href}>
              Open record
            </a>
          ) : null}
          {onStep ? (
            <nav className="ds-sheet__pager" aria-label="Records in this list">
              <button
                type="button"
                className="ds-sheet__step"
                onClick={() => onStep(-1)}
                aria-label="Previous record"
              >
                <StepIcon direction={-1} />
              </button>
              {position ? (
                <span className="ds-sheet__position">
                  {position.index.toLocaleString('en-US')} of{' '}
                  {position.total.toLocaleString('en-US')}
                </span>
              ) : null}
              <button
                type="button"
                className="ds-sheet__step"
                onClick={() => onStep(1)}
                aria-label="Next record"
              >
                <StepIcon direction={1} />
              </button>
            </nav>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
