/**
 * Corrections page sections: review process beats, intake form panel, post-submit
 * steps, and compact footer links — matching methodology delivery patterns.
 */
import React, { Suspense } from 'react';
import Link from 'next/link';
import { Notice } from '@repo/ui';
import { UtilityEditionBodyPanel } from '../../components/patterns/utility-edition/UtilityEditionBodyPanel';
import { CorrectionForm } from './CorrectionForm';
import { CORRECTION_PRIVACY_NOTICE } from './copy';
import './corrections.css';

const PAGE_SECTIONS = [
  { id: 'how-it-works', label: 'How it works' },
  { id: 'submit', label: 'Submit' },
  { id: 'after-submit', label: 'After submit' },
] as const;

const REVIEW_BEATS = [
  {
    kicker: 'Quarantine only',
    body: 'Every submission enters a restricted review queue. Nothing you send changes the public record until it passes independent verification.',
  },
  {
    kicker: 'Receipt code',
    body: 'You receive a receipt code — the only way to check status. We cannot look up submissions without it.',
  },
  {
    kicker: 'No volume bias',
    body: 'Moderators review every correction; coordinated volume never alters confidence or publication.',
  },
] as const;

const AFTER_SUBMIT_STEPS: readonly React.ReactNode[] = [
  'Save your receipt code immediately — it is the only credential for status lookup.',
  'Moderators verify your claim against primary and secondary sources before any public change.',
  'If closed and you believe the outcome was wrong, one appeal is available via the same receipt code.',
  <>
    Read{' '}
    <Link href="/methodology">how disputes and review are handled</Link> on the methodology page.
  </>,
] as const;

function RuleStrip({
  rules,
  label,
}: {
  readonly rules: readonly React.ReactNode[];
  readonly label: string;
}) {
  return (
    <ol className="ds-corrections__rule-strip" aria-label={label}>
      {rules.map((rule, index) => (
        <li key={index} className="ds-corrections__rule-row">
          <span className="ds-corrections__rule-text">{rule}</span>
        </li>
      ))}
    </ol>
  );
}

export function CorrectionsSections() {
  return (
    <UtilityEditionBodyPanel className="ds-corrections">
      <div className="ds-corrections__inner">
      <nav className="ds-corrections__nav" aria-labelledby="corrections-toc-title">
        <p className="ds-corrections__nav-title" id="corrections-toc-title">
          On this page
        </p>
        <ul className="ds-corrections__nav-list">
          {PAGE_SECTIONS.map((section) => (
            <li key={section.id}>
              <a className="ds-corrections__nav-link" href={`#${section.id}`}>
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="ds-entity-sections">
        <section
          className="ds-section ds-record-section ds-section--flush"
          aria-labelledby="how-it-works-title"
          id="how-it-works"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            Review lane
          </p>
          <h2 className="ds-section__title" id="how-it-works-title">
            How corrections are handled
          </h2>
          <p className="ds-section__lede">
            Challenge a published record, suggest missing evidence, or report a precision issue.
            Corrections are normal system function — not an admission of failure.
          </p>
          <ul className="ds-corrections__beat-grid">
            {REVIEW_BEATS.map((beat) => (
              <li key={beat.kicker} className="ds-corrections__beat">
                <p className="ds-corrections__beat-kicker">{beat.kicker}</p>
                <p className="ds-corrections__beat-body">{beat.body}</p>
              </li>
            ))}
          </ul>
          <Notice className="ds-corrections__callout" tone="warning" title="This is not a public post">
            Corrections enter a restricted quarantine queue for human review. Nothing you submit
            changes the public record until it passes independent review and promotion controls.{' '}
            {CORRECTION_PRIVACY_NOTICE.body}
          </Notice>
        </section>

        <section
          className="ds-section ds-record-section"
          aria-labelledby="submit-title"
          id="submit"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            Intake form
          </p>
          <h2 className="ds-section__title" id="submit-title">
            Submit a correction
          </h2>
          <p className="ds-section__lede">
            Point to the record, describe what should change, and cite a supporting source. Optional
            contact details stay with moderators only.
          </p>
          <div className="ds-corrections__form-panel">
            <Suspense fallback={<p className="ds-sans">Loading correction form…</p>}>
              <CorrectionForm />
            </Suspense>
          </div>
        </section>

        <section
          className="ds-section ds-record-section"
          aria-labelledby="after-submit-title"
          id="after-submit"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            What happens next
          </p>
          <h2 className="ds-section__title" id="after-submit-title">
            After you submit
          </h2>
          <p className="ds-section__lede">
            Status updates are available only through your receipt code. Moderation details stay
            restricted.
          </p>
          <RuleStrip label="Post-submit steps" rules={AFTER_SUBMIT_STEPS} />
        </section>
      </div>

      <section className="ds-section ds-corrections__next" aria-labelledby="next-corrections" id="next">
        <h2 className="ds-section__title" id="next-corrections">
          Keep going
        </h2>
        <p className="ds-band__cta">
          <Link className="ds-cta-link" href="/methodology">
            Methodology
          </Link>
          {' · '}
          <Link className="ds-cta-link" href="/errata">
            Errata log
          </Link>
          {' · '}
          <Link className="ds-cta-link" href="/">
            Open the map
          </Link>
        </p>
      </section>
      </div>
    </UtilityEditionBodyPanel>
  );
}
