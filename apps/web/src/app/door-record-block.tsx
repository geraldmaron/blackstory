/**
 * One record on the home page, shown the way its record page shows it: the name (a link to the
 * record), its own sourced photograph as a plate with its credit when it has one, and one claim in
 * the claims block's language (copper numeral, the statement in the editorial serif, its source as
 * a link, the grade as a glyph and a word). Used by the opening and by every decade of the walk.
 */
import React from 'react';
import { RecordImage } from '../components/entity/RecordImage';
import { EvidenceList } from '../components/evidence/EvidenceList';
import type { DoorJourneyRecord } from './door-decade-walk';
import { DoorRecordLink } from './door-record-link';

void React;

/** The plate's slot in the dock column; Commons serves the nearest thumbnail step at 2x. */
const PLATE_SLOT_PX = 440;

export function DoorRecordBlock({
  record,
  className,
}: {
  readonly record: DoorJourneyRecord;
  readonly className?: string;
}) {
  return (
    <div className={['ds-door-record', className].filter(Boolean).join(' ')}>
      <p className="ds-door-record__name">
        <DoorRecordLink href={record.href}>{record.name}</DoorRecordLink>
      </p>
      {record.locality ? <p className="ds-door-record__place">{record.locality}</p> : null}
      {record.plate ? (
        <RecordImage
          entityId={record.pinId ?? 'door'}
          entityName={record.name}
          image={record.plate}
          plate
          width={PLATE_SLOT_PX}
          className={`ds-door-record__plate${record.person ? ' ds-plate--upper' : ''}`}
        />
      ) : null}
      <EvidenceList items={[record.claim]} />
    </div>
  );
}
