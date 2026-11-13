/**
 * The correction room's body: what happens to a submission, the intake form, and the receipt lookup.
 *
 * The explanation is stated as the three steps a correction actually goes through, above the form,
 * in one strip.
 */
import React, { Suspense } from 'react';
import Link from 'next/link';
import { CorrectionForm, type CorrectionFormProps } from './CorrectionForm';
import { CORRECTION_PRIVACY_NOTICE } from './copy';
import { Disclosure, RoomSection, UtilityStep } from '../../components/room';
import './corrections.css';

/** The lifecycle, in the order it happens. Step one is done the moment the form is sent. */
const INTAKE_STEPS = [
  { title: 'Your correction', detail: 'Nothing publishes on arrival' },
  { title: 'Review', detail: 'By a person, usually within ten working days' },
  { title: 'Published or declined, with a reason', detail: 'Accepted changes appear in Errata' },
] as const;

export function CorrectionsSections(props: CorrectionFormProps) {
  return (
    <div className="ds-corrections">
      <RoomSection id="file" title="What happens to a correction">
        <ol className="ds-corrections__lifecycle" aria-label="What happens to a correction">
          {INTAKE_STEPS.map((step, index) => (
            <li key={step.title}>
              <UtilityStep index={index + 1} title={step.title} detail={step.detail} />
            </li>
          ))}
        </ol>

        <Suspense fallback={<p className="ds-room-field__hint">Loading the correction form…</p>}>
          <CorrectionForm {...props} />
        </Suspense>

        {/*
         * The privacy terms stay on the page and stay readable, but collapsed: they are the thing a
         * reader consults once and a bordered warning banner above the form made every correction
         * feel like an accusation being logged. A drawer's job is to not be in the way.
         */}
        <Disclosure summary="What happens to what you send">
          <p>
            Corrections go into a private queue. Nothing you submit changes the public record until
            a person has read it against the sources. {CORRECTION_PRIVACY_NOTICE.body}
          </p>
          <p>
            Save your receipt code. It is the only credential for a status lookup, and a submission
            cannot be found without it. If a correction is closed and you believe the outcome was
            wrong, one appeal is available against the same code. Every correction is read by a
            person, and coordinated volume never alters confidence or publication.
          </p>
        </Disclosure>

        <p>
          Already have a code? <Link href="/corrections/status">Check a receipt</Link>.
        </p>
      </RoomSection>
    </div>
  );
}
