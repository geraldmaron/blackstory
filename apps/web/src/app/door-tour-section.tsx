/**
 * The tour: a few real records, one stop each, between the opening and the grade band.
 *
 * One scene, not a column of articles. The map is the ground for the whole tour; each stop is a
 * screen of scroll, and its words (the record's photograph with its credit, its name, where it is
 * and how exactly, one sourced claim, and one way into the record) hold still in one place and
 * cross-fade as the camera travels to the next record (door-tour.css, door-tour-scroll.tsx).
 * The scroll is the page's own: nothing is captured.
 *
 * Server-rendered and complete without JavaScript, where the stops are a stacked list of records.
 * Each stop is an ordinary heading and link, in document order, whichever one is showing.
 */
import React from 'react';
import { buttonClassName } from '@repo/ui';
import { RecordImage } from '../components/entity/RecordImage';
import { EvidenceList } from '../components/evidence/EvidenceList';
import { precisionInWords } from '../lib/map-experience/geo-precision';
import type { DoorJourneyRecord } from './door-decade-walk';
import { DoorRecordLink } from './door-record-link';
import { DoorTourScroll, type DoorTourStep } from './door-tour-scroll';
import { tourHeading } from './door-tour';

void React;

/** The plate's slot beside the map; Commons serves the nearest thumbnail step at 2x. */
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
  const heading = tourHeading(records);
  return (
    // The world is night in both themes, so the tour's words, rail and shade take the ink
    // ground's tokens whatever the reader's theme is.
    <section
      className="ds-door-tour"
      aria-labelledby="door-tour-heading"
      data-ground="ink"
      data-ground-fixed=""
    >
      {/* The way in, at the foot of the opening screen: it names what is below and goes there. */}
      <a className="ds-door-tour__cue" href={`#${steps[0]!.id}`}>
        Scroll for {heading.charAt(0).toLowerCase()}
        {heading.slice(1)}
      </a>
      <DoorTourScroll steps={steps} />
      <div className="ds-door-tour__body">
        <h2 className="ds-visually-hidden" id="door-tour-heading">
          {heading}
        </h2>
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
                    <h3 className="ds-door-tour__name" id={`${step.id}-name`}>
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
                        className={`ds-door-record__plate ds-door-tour__plate${record.person ? ' ds-plate--upper' : ''}`}
                      />
                    ) : null}
                    <EvidenceList items={[{ ...record.claim, id: `${step.id}-claim` }]} />
                    <DoorRecordLink
                      className={buttonClassName('primary', 'ds-door-tour__open')}
                      href={record.href}
                    >
                      Open the record
                      <span className="ds-visually-hidden">, {record.name}</span>
                    </DoorRecordLink>
                  </div>
                </section>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
