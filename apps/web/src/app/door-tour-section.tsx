/**
 * The tour: a few real records, one step each, between the opening and the grade band.
 *
 * Server-rendered and complete without JavaScript: a heading, one line of prompt, a way past it,
 * and one section per record (its name, where it is and how exactly, its photograph as a plate
 * with the credit, one sourced claim, a link to the record). With JavaScript the map follows the
 * reader's scroll (door-tour-scroll.tsx). Each step is an ordinary heading and link; the copper
 * numeral carries the step.
 */
import React from 'react';
import { RecordImage } from '../components/entity/RecordImage';
import { EvidenceList } from '../components/evidence/EvidenceList';
import { precisionInWords } from '../lib/map-experience/geo-precision';
import type { DoorJourneyRecord } from './door-decade-walk';
import { DoorRecordLink } from './door-record-link';
import { DoorTourScroll, type DoorTourStep } from './door-tour-scroll';
import { tourHeading } from './door-tour';

void React;

const PLATE_SLOT_PX = 440;

export type DoorTourProps = {
  readonly records: readonly DoorJourneyRecord[];
};

export function DoorTour({ records }: DoorTourProps) {
  if (records.length === 0) return null;
  const steps: DoorTourStep[] = records.map((record, i) => ({
    id: `door-tour-step-${i + 1}`,
    pinId: record.pinId,
    lngLat: record.lngLat,
    precision: record.precision,
    label: record.locality ?? record.name,
    name: record.name,
    person: record.person,
    ...(record.plate ? { plate: record.plate } : {}),
  }));
  return (
    <section className="ds-door-tour" aria-labelledby="door-tour-heading">
      <DoorTourScroll steps={steps} />
      <div className="ds-door-tour__body" data-ground="ink" data-ground-fixed="">
        <div className="ds-door-tour__intro ds-door-tour__card">
          <h2 className="ds-door-tour__title" id="door-tour-heading">
            {tourHeading(records)}
          </h2>
          <p className="ds-door-tour__prompt">Scroll, and the map follows.</p>
          <a className="ds-door-tour__skip" href="#door-ch-evidence-band">
            Skip the tour
          </a>
        </div>
        <ol className="ds-door-tour__steps">
          {records.map((record, i) => {
            const step = steps[i]!;
            return (
              <li key={step.id} className="ds-door-tour__item">
                <section
                  className="ds-door-tour__step"
                  id={step.id}
                  aria-labelledby={`${step.id}-name`}
                  data-tour-step={i}
                >
                  <div className="ds-door-tour__card ds-door-record">
                    <p className="ds-door-tour__num" aria-hidden="true">
                      {i + 1}
                    </p>
                    <h3 className="ds-door-record__name" id={`${step.id}-name`}>
                      {record.name}
                    </h3>
                    <p className="ds-door-record__place">
                      {record.locality ? `${record.locality}. ` : ''}
                      {precisionInWords(record.precision)}.
                    </p>
                    {record.plate ? (
                      <RecordImage
                        entityId={record.pinId ?? step.id}
                        entityName={record.name}
                        image={record.plate}
                        plate
                        width={PLATE_SLOT_PX}
                        className={`ds-door-record__plate${record.person ? ' ds-plate--upper' : ''}`}
                      />
                    ) : null}
                    <EvidenceList items={[{ ...record.claim, id: `${step.id}-claim` }]} />
                    <DoorRecordLink className="ds-door-tour__open" href={record.href}>
                      Open the record
                      <span className="ds-visually-hidden">, {record.name}</span>
                    </DoorRecordLink>
                  </div>
                </section>
              </li>
            );
          })}
        </ol>
        <p className="ds-door-tour__end ds-door-tour__card">
          Every record here carries a grade. The next section says what the grades mean.
        </p>
      </div>
    </section>
  );
}
