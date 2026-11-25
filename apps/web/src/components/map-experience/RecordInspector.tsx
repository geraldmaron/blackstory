/**
 * The record inspector: what a selection opens, in the Explore column on a wide screen and in the
 * bottom sheet on a phone. Non-modal on purpose: the map stays live beside it, so a reader can
 * compare the record against its geography without dismissing anything.
 *
 * An inspector, not a miniature record page: the photo when the archive holds one, kind and place,
 * the name, a two-line summary, where the archive can place it in words, the evidence signal, one
 * way onto the record, and a quiet previous/next through the current list. Sources, connections
 * and the visit block live on the record page, one click away.
 *
 * The precision line is not optional and not editorial: it is the archive stating what its own
 * mark on the map means, and it renders for every record.
 */
'use client';

import React, { useEffect, useRef } from 'react';
import { Button, cx } from '@repo/ui';
import type { ConfidenceTierKey } from '../../lib/map-experience/confidence-icons';
import { evidenceCountPhrase } from '../../lib/map-experience/evidence-grade';
import { precisionInWords } from '../../lib/map-experience/geo-precision';
import { placeDetail } from '../../lib/map-experience/place-label';
import { entityPrimaryImageAlt, kindLabelForMark } from '../entity/record-mark';
import { GradeTag } from '../evidence/EvidenceList';
import { confidenceLevelFor } from './ExploreRecordList';
import './record-inspector.css';

void React;

export type InspectorRecord = {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly place: string;
  readonly story: string;
  /** Stored public precision (`ExploreMapFeatureProperties.precision`). */
  readonly precision: string;
  readonly confidenceTier: ConfidenceTierKey;
  /** "Grade A · 2 sources". */
  readonly evidenceLabel: string;
  readonly decade?: string;
  readonly href?: string;
  /** The record's own photo, when the archive holds one. Never a placeholder. */
  readonly photoUrl?: string;
  /** The photo's credit line, printed under the plate (never on it). */
  readonly photoCredit?: string;
  /** The photo's alt text; empty when the archive has none. */
  readonly photoAlt?: string;
};

export type RecordInspectorProps = {
  readonly record: InspectorRecord;
  /** Position within the current list, 1-based. */
  readonly position?: { readonly index: number; readonly total: number };
  readonly onStep?: (direction: 1 | -1) => void;
  readonly className?: string;
};

function StepIcon({ direction }: { readonly direction: 1 | -1 }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
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

export function RecordInspector({ record, position, onStep, className }: RecordInspectorProps) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  /** A newly opened record takes focus, so a keyboard reader lands on it. */
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [record.id]);

  const kind = kindLabelForMark(record.kind) ?? 'Record';
  const place = placeDetail(record.name, record.place);
  const count = evidenceCountPhrase(record.evidenceLabel);

  return (
    <article className={cx('ds-inspector', className)} aria-labelledby="ds-inspector-name">
      {/* The photograph as it is: in color, at the column's width, its credit under it. The
          archive does not store when it was taken, so the panel says so (v12). */}
      {record.photoUrl ? (
        <figure className="ds-inspector__photo">
          {/* eslint-disable-next-line @next/next/no-img-element -- public CDN URL, the record's own photo */}
          <img
            src={record.photoUrl}
            alt={entityPrimaryImageAlt(record.photoAlt, record.name)}
            decoding="async"
          />
          <figcaption>
            {record.photoCredit ? <span>{record.photoCredit}</span> : null}
            <span>The photograph’s date is not on record.</span>
          </figcaption>
        </figure>
      ) : null}

      <div className="ds-inspector__body">
        <p className="ds-inspector__meta">
          {/* One line, like the list row: a long place never pushes the record below the fold. */}
          <span className="ds-inspector__where" title={place ? `${kind} · ${place}` : undefined}>
            {kind}
            {place ? ` · ${place}` : ''}
          </span>
        </p>
        <h2 className="ds-inspector__name" id="ds-inspector-name" tabIndex={-1} ref={headingRef}>
          {record.name}
        </h2>
        {record.decade ? (
          <p className="ds-inspector__when">First documented in the {record.decade}</p>
        ) : null}
        {record.story ? <p className="ds-inspector__summary">{record.story}</p> : null}

        <dl className="ds-inspector__facts">
          <div className="ds-inspector__fact">
            <dt>Where</dt>
            <dd>{precisionInWords(record.precision)}</dd>
          </div>
          <div className="ds-inspector__fact">
            <dt>Evidence</dt>
            <dd className="ds-inspector__evidence">
              <GradeTag level={confidenceLevelFor(record.confidenceTier)} />
              {count ? <span className="ds-inspector__count">{count}</span> : null}
            </dd>
          </div>
        </dl>

        <div className="ds-inspector__actions">
          {record.href ? (
            <Button variant="primary" href={record.href}>
              Open record
            </Button>
          ) : null}
          {onStep ? (
            <nav className="ds-inspector__pager" aria-label="Records in this list">
              <button
                type="button"
                className="ds-inspector__step"
                onClick={() => onStep(-1)}
                aria-label="Previous record"
              >
                <StepIcon direction={-1} />
              </button>
              {position ? (
                <span className="ds-inspector__position">
                  {position.index.toLocaleString('en-US')} of{' '}
                  {position.total.toLocaleString('en-US')}
                </span>
              ) : null}
              <button
                type="button"
                className="ds-inspector__step"
                onClick={() => onStep(1)}
                aria-label="Next record"
              >
                <StepIcon direction={1} />
              </button>
            </nav>
          ) : null}
        </div>
      </div>
    </article>
  );
}
