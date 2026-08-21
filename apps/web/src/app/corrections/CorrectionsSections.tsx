/**
 * The correction room's body: what happens to a submission, the intake form, and the way out.
 *
 * Rewritten onto the v9 room kit. This surface used to carry its own chrome — a page nav, three
 * numbered `ds-section` blocks with mono-caps kickers, a beat grid and a bordered callout — and
 * put roughly a screen and a half of explanation in front of the one control a person came here
 * to use. The explanation is not gone; it is stated as the three steps a correction actually
 * goes through, above the form, in one strip.
 */
import React, { Suspense } from 'react';
import Link from 'next/link';
import { CorrectionForm } from './CorrectionForm';
import { CORRECTION_PRIVACY_NOTICE } from './copy';
import { Disclosure, OffRamp, UtilityStep } from '../../components/room';
import './corrections.css';

/** The lifecycle, in the order it happens. Step one is done the moment the form is sent. */
const INTAKE_STEPS = [
  { title: 'Your correction', detail: 'Nothing publishes on arrival' },
  { title: 'Review', detail: 'By a person, usually within ten working days' },
  { title: 'Published or declined, with a reason', detail: 'Accepted changes appear in Errata' },
] as const;

export function CorrectionsSections() {
  return (
    <div className="ds-corrections">
      <ol className="ds-corrections__lifecycle" aria-label="What happens to a correction">
        {INTAKE_STEPS.map((step, index) => (
          <li key={step.title}>
            <UtilityStep index={index + 1} title={step.title} detail={step.detail} />
          </li>
        ))}
      </ol>

      <Suspense fallback={<p className="ds-room-field__hint">Loading the correction form…</p>}>
        <CorrectionForm />
      </Suspense>

      {/*
       * The privacy terms stay on the page and stay readable, but collapsed: they are the thing a
       * reader consults once and a bordered warning banner above the form made every correction
       * feel like an accusation being logged. A drawer's job is to not be in the way.
       */}
      <Disclosure summary="What happens to what you send">
        <p>
          Corrections enter a restricted quarantine queue for human review. Nothing you submit
          changes the public record until it passes independent review and promotion controls.{' '}
          {CORRECTION_PRIVACY_NOTICE.body}
        </p>
        <p>
          Save your receipt code. It is the only credential for a status lookup, and we cannot find
          a submission without it. If a correction is closed and you believe the outcome was wrong,
          one appeal is available against the same code. Moderators review every correction;
          coordinated volume never alters confidence or publication.
        </p>
      </Disclosure>

      <OffRamp
        title={
          <>
            Every accepted correction is <em>published</em>
          </>
        }
        actions={[
          { href: '/errata', label: 'Errata log', emphasis: 'copper' },
          { href: '/methodology', label: 'How disputes are handled' },
          { href: '/', label: 'Open the Atlas' },
        ]}
      >
        Mistakes are published rather than overwritten, with the record they changed.{' '}
        <Link href="/corrections/status">Check a receipt</Link> if you already have a code.
      </OffRamp>
    </div>
  );
}
