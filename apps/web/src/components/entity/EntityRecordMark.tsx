/**
 * Flat matte symbolic record mark for entities without a rights-cleared primaryImage.
 * Kind selects book, pin, or arch silhouette — never a portrait or photo mosaic.
 * Accessible name (aria-labelledby) and figcaption stay aligned with why the mark is shown.
 */
import React from 'react';
import {
  RECORD_MARK_SHAPE_META,
  kindLabelForMark,
  recordMarkAlt,
  recordMarkCaption,
  selectRecordMarkShape,
  type RecordMarkReason,
  type RecordMarkShape,
} from './record-mark';

void React;

export type EntityRecordMarkProps = {
  readonly entityId: string;
  readonly entityName: string;
  readonly kind?: string;
  readonly jurisdictionLabel?: string;
  /** Why this mark is shown — drives both accessible name and visible caption. */
  readonly reason?: RecordMarkReason;
};

export function EntityRecordMark({
  entityId,
  entityName,
  kind,
  jurisdictionLabel,
  reason = 'absent',
}: EntityRecordMarkProps) {
  const shape = selectRecordMarkShape(kind);
  const kindLabel = kindLabelForMark(kind);
  const suffix = hashSuffix(entityId);
  const nameId = `record-mark-name-${suffix}`;
  const captionId = `record-mark-caption-${suffix}`;
  const markId = `record-mark-${shape}-${suffix}`;

  const accessibleName = recordMarkAlt({
    entityName,
    shape,
    ...(kindLabel !== undefined ? { kindLabel } : {}),
    ...(jurisdictionLabel !== undefined ? { jurisdictionLabel } : {}),
  });
  const caption = recordMarkCaption(reason);

  const contextParts = [kindLabel, jurisdictionLabel].filter(
    (part): part is string => typeof part === 'string' && part.trim().length > 0,
  );

  return (
    <figure className="ds-entity-photo ds-entity-photo--mark">
      <div className="ds-entity-mark">
        <div
          className="ds-entity-mark__frame"
          role="img"
          aria-labelledby={nameId}
          aria-describedby={captionId}
        >
          <span id={nameId} className="ds-visually-hidden">
            {accessibleName}
          </span>
          <svg
            className="ds-entity-mark__svg"
            viewBox="0 0 240 280"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            focusable="false"
          >
            <rect width="240" height="280" fill="#F4EFE5" />
            <RecordMarkShapeGraphic shape={shape} markId={markId} />
          </svg>
        </div>
        {contextParts.length > 0 ? (
          <p className="ds-entity-mark__context ds-mono" aria-hidden="true">
            {contextParts.join(' · ')}
          </p>
        ) : null}
      </div>
      <figcaption id={captionId} className="ds-entity-photo__credit ds-sans">
        {caption}
        <span className="ds-mono"> · {RECORD_MARK_SHAPE_META[shape].label}</span>
      </figcaption>
    </figure>
  );
}

function hashSuffix(entityId: string): string {
  return entityId.replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'x';
}

function RecordMarkShapeGraphic({
  shape,
  markId,
}: {
  readonly shape: RecordMarkShape;
  readonly markId: string;
}) {
  switch (shape) {
    case 'book':
      return (
        <g id={markId}>
          <path
            d="M28 52c28-18 60-26 92-26s64 8 92 26v188c-28-14-60-22-92-22s-64 8-92 22V52zm92 8c-30 0-58 6-80 16v152c22-10 50-16 80-16V60zm0 0c30 0 58 6 80 16v152c-22-10-50-16-80-16V60z"
            fill="#161616"
          />
          <rect x="118" y="52" width="4" height="188" fill="#B86B2A" aria-hidden="true" />
          <path
            d="M28 52c28-18 60-26 92-26s64 8 92 26v188c-28-14-60-22-92-22s-64 8-92 22V52zm92 8c-30 0-58 6-80 16v152c22-10 50-16 80-16V60zm0 0c30 0 58 6 80 16v152c-22-10-50-16-80-16V60z"
            fill="none"
            stroke="#0A0A0A"
            strokeWidth="1.5"
          />
        </g>
      );
    case 'pin':
      return (
        <g id={markId}>
          <path
            fillRule="evenodd"
            d="M120 272S48 178 48 112a72 72 0 1 1 144 0c0 66-72 160-72 160z"
            fill="#161616"
          />
          <circle cx="120" cy="112" r="36" fill="#B86B2A" aria-hidden="true" />
          <path
            fillRule="evenodd"
            d="M120 272S48 178 48 112a72 72 0 1 1 144 0c0 66-72 160-72 160zm0-124a36 36 0 1 0 0-72 36 36 0 0 0 0 72z"
            fill="none"
            stroke="#0A0A0A"
            strokeWidth="1.5"
          />
        </g>
      );
    case 'arch':
      return (
        <g id={markId}>
          <path
            d="M40 272V120C40 64 78 24 120 24s80 40 80 96v152h-40V124c0-24-18-44-40-44s-40 20-40 44v148H40z"
            fill="#161616"
          />
          <path
            d="M40 272V120C40 64 78 24 120 24s80 40 80 96v152h-40V124c0-24-18-44-40-44s-40 20-40 44v148H40z"
            fill="none"
            stroke="#0A0A0A"
            strokeWidth="1.5"
          />
        </g>
      );
    default: {
      const _exhaustive: never = shape;
      return _exhaustive;
    }
  }
}
