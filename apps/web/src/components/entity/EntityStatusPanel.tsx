/**
 * Kind-appropriate BB-090 status panel. Place/school/institution kinds render the derived current
 * status plus the full time-scoped `statusHistory` record; `event` kinds have no status field by
 * design (their when-span is authoritative — BB-090 `STATUSLESS_ENTITY_KINDS`) and render an
 * `eventWindow` panel instead. The historical-vs-present-day framing badge is a prop supplied by
 * the caller's derivation over the status field (see `../../app/entity/[id]/entity-view-model.ts`
 * `deriveHistoricalFraming`) — this component never re-derives it from prose.
 */

import React from 'react';
import { Card } from '@black-book/ui';
import type { PublicEntityView, PublicEventWindow } from '../../data/public-seed';
import { humanizeToken } from './format';
import { RecordGapNotice } from './RecordGapNotice';

export type HistoricalFraming = 'historical' | 'present_day';

export type EntityStatusPanelProps = {
  readonly entity: PublicEntityView;
  readonly framing: HistoricalFraming;
};

function framingLabel(framing: HistoricalFraming): string {
  return framing === 'present_day' ? 'Present-day record' : 'Historical record';
}

function formatEventWindow(window: PublicEventWindow): string {
  if (!window.startAt) return 'Undated';
  if (!window.endAt) return window.startAt;
  return `${window.startAt} \u2013 ${window.endAt}`;
}

export function EntityStatusPanel({ entity, framing }: EntityStatusPanelProps) {
  if (entity.kind === 'event') {
    return (
      <Card title="When this happened" meta={<span className="bb-mono">{framingLabel(framing)}</span>}>
        <p className="bb-sans" style={{ margin: 0 }}>
          {entity.eventWindow ? formatEventWindow(entity.eventWindow) : 'Undated'}
          {entity.eventWindow?.eventType ? ` \u00b7 ${humanizeToken(entity.eventWindow.eventType)}` : ''}
        </p>
        <p className="bb-sans" style={{ margin: 0, marginTop: 'var(--bb-space-2)' }}>
          Events carry no active/historic status of their own — a when-span is authoritative
          instead (BB-090).
        </p>
      </Card>
    );
  }

  if (!entity.status || !entity.statusHistory || entity.statusHistory.length === 0) {
    return <RecordGapNotice kind="statusHistory" />;
  }

  return (
    <Card
      title={`Status: ${humanizeToken(entity.status)}`}
      meta={<span className="bb-mono">{framingLabel(framing)}</span>}
    >
      <ol className="bb-qualify-list" aria-label="Status history" style={{ marginTop: 'var(--bb-space-4)' }}>
        {entity.statusHistory.map((record, index) => (
          <li key={`${entity.id}_status_${index}`}>
            <span className="bb-mono">{humanizeToken(record.status)}</span>
            {' \u2014 '}
            {record.validFrom ?? 'undated'}
            {record.validTo ? ` through ${record.validTo}` : ', ongoing'}
          </li>
        ))}
      </ol>
    </Card>
  );
}
