/**
 * Public correction status. Shows coarse phases only, never spam scores, campaign flags,
 * duplicate lists, or other moderation-sensitive metadata. Below the receipt: the appeal when
 * one is open, and the abuse report.
 */
import React from 'react';
import Link from 'next/link';
import { SectionHeading } from '@repo/ui';
import type { PublicCorrectionStatus } from './public-status';
import { ReceiptBlock } from './ReceiptBlock';
import { ReceiptFollowUpForm } from './ReceiptFollowUpForm';
import { ABUSE_REPORT_NOTICE, APPEAL_ELIGIBILITY_NOTICE } from './copy';

void React;

export function CorrectionStatusPanel({ status }: { readonly status: PublicCorrectionStatus }) {
  return (
    <>
      <ReceiptBlock
        receiptCode={status.receiptCode}
        phase={status.phase}
        submittedAt={status.submittedAt}
        updatedAt={status.updatedAt}
      />

      {status.phase === 'closed' && status.outcomeReason ? (
        <p className="ds-trust-lead">Declined: {status.outcomeReason}</p>
      ) : null}

      <p className="ds-trust-note">
        Nothing you sent is public. If your correction is declined, you get the reason. Volume of
        corrections never changes public confidence or publication, and coordinated activity is
        reviewed separately and is not shown here. An accepted correction appears in{' '}
        <Link href="/errata">Errata</Link> with the record it changed.
      </p>

      <section className="ds-receipt-followup" aria-labelledby="appeal-heading">
        <SectionHeading id="appeal-heading">Appeal</SectionHeading>
        {status.appealAvailable ? (
          <>
            <p>{APPEAL_ELIGIBILITY_NOTICE}</p>
            <ReceiptFollowUpForm kind="appeal" receiptCode={status.receiptCode} />
          </>
        ) : (
          <p>
            Not open for this receipt. An appeal opens once a correction is closed or a
            classification dispute is resolved, and each receipt gets one.
          </p>
        )}
      </section>

      <section className="ds-receipt-followup" aria-labelledby="abuse-heading">
        <SectionHeading id="abuse-heading">Report abuse</SectionHeading>
        <p>{ABUSE_REPORT_NOTICE}</p>
        <ReceiptFollowUpForm kind="abuse" receiptCode={status.receiptCode} />
      </section>
    </>
  );
}
