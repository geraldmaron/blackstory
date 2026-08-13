/**
 * Kind-appropriate status panel. Place/school/institution kinds render the derived current
 * status plus the full time-scoped `statusHistory` record when present; `event` kinds have no
 * status field by design (their when-span is authoritative `STATUSLESS_ENTITY_KINDS`) and render
 * an `eventWindow` panel instead. The mast's glance line carries the one-word standing; this
 * panel does not nest a second titled Card under the section heading.
 */

import React from 'react';
import type { PublicEntityView, PublicEventWindow } from '../../data/public-seed';
import { StatusMark } from '../map-experience';
import { humanizeToken } from './format';
import { RecordGapNotice } from './RecordGapNotice';

export type EntityStatusPanelProps = {
  readonly entity: PublicEntityView;
};

function formatEventWindow(window: PublicEventWindow): string {
  if (!window.startAt) return 'Undated';
  if (!window.endAt) return window.startAt;
  return `${window.startAt} \u2013 ${window.endAt}`;
}

export function EntityStatusPanel({ entity }: EntityStatusPanelProps) {
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

  const currentStatus = entity.status;
  const history = entity.statusHistory;

  // `unknown` is the absence of a finding, not a finding. Catalog derivation returns it when the
  // sources give no cue either way, and with no lifecycle span behind it there is nothing to show
  // but a shrug — the gap notice says the same thing in the approved words.
  const undetermined = !currentStatus || currentStatus === 'unknown';
  if (undetermined && (!history || history.length === 0)) {
    return <RecordGapNotice kind="statusHistory" />;
  }

  return (
    <div className="ds-entity-status">
      {currentStatus ? (
        <p className="ds-entity-status__current">
          <span className="ds-mono">Current status</span>
          <StatusMark status={currentStatus} labeled />
        </p>
      ) : null}
      {history && history.length > 0 ? (
        <ol className="ds-qualify-list" aria-label="Status history">
          {history.map((record, index) => (
            <li key={`${entity.id}_status_${index}`}>
              <span className="ds-mono">{humanizeToken(record.status)}</span>
              {' \u2014 '}
              {record.validFrom ?? 'undated'}
              {record.validTo ? ` through ${record.validTo}` : ', ongoing'}
            </li>
          ))}
        </ol>
      ) : (
        <p className="ds-sans ds-entity-status__note">
          A fuller time-scoped status history has not been published for this record yet.
        </p>
      )}
    </div>
  );
}
