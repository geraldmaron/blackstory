/**
 * Kind-appropriate status panel. Place/school/institution kinds render the derived current
 * status plus the full time-scoped `statusHistory` record; `event` kinds have no status field by
 * design (their when-span is authoritative `STATUSLESS_ENTITY_KINDS`) and render an
 * `eventWindow` panel instead. Framing is owned by the entity mast — this panel does not repeat
 * historical-vs-present-day badges or nest a second titled Card under the section heading.
 */

import React from 'react';
import type { PublicEntityView, PublicEventWindow } from '../../data/public-seed';
import { StatusMark } from '../map-experience';
import { humanizeToken } from './format';
import { RecordGapNotice } from './RecordGapNotice';

export type HistoricalFraming = 'historical' | 'present_day';

export type EntityStatusPanelProps = {
  readonly entity: PublicEntityView;
  readonly framing: HistoricalFraming;
};

function formatEventWindow(window: PublicEventWindow): string {
  if (!window.startAt) return 'Undated';
  if (!window.endAt) return window.startAt;
  return `${window.startAt} \u2013 ${window.endAt}`;
}

export function EntityStatusPanel({ entity, framing: _framing }: EntityStatusPanelProps) {
  if (entity.kind === 'event') {
    return (
      <div className="ds-entity-status">
        <p className="ds-sans" style={{ margin: 0 }}>
          {entity.eventWindow ? formatEventWindow(entity.eventWindow) : 'Undated'}
          {entity.eventWindow?.eventType
            ? ` \u00b7 ${humanizeToken(entity.eventWindow.eventType)}`
            : ''}
        </p>
        <p className="ds-sans ds-entity-status__note">
          Events carry no active/historic status of their own — a when-span is authoritative
          instead.
        </p>
      </div>
    );
  }

  if (!entity.status || !entity.statusHistory || entity.statusHistory.length === 0) {
    return <RecordGapNotice kind="statusHistory" />;
  }

  return (
    <div className="ds-entity-status">
      <p className="ds-entity-status__current">
        <span className="ds-mono">Current status</span>
        <StatusMark status={entity.status} labeled />
      </p>
      <ol className="ds-qualify-list" aria-label="Status history">
        {entity.statusHistory.map((record, index) => (
          <li key={`${entity.id}_status_${index}`}>
            <span className="ds-mono">{humanizeToken(record.status)}</span>
            {' \u2014 '}
            {record.validFrom ?? 'undated'}
            {record.validTo ? ` through ${record.validTo}` : ', ongoing'}
          </li>
        ))}
      </ol>
    </div>
  );
}
