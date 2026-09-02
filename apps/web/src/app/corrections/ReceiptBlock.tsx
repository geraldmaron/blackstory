/**
 * The receipt: the code, and where the correction has got to.
 *
 * Rendered on the status page and, with no phase yet, straight after a submission. It replaced a
 * bordered "Status" warning notice holding a definition list — a receipt is not a warning, and
 * the one thing on the screen a person has to keep was set at body size inside it.
 */
import React from 'react';
import { UtilityStep } from '../../components/room';
import type { PublicCorrectionPhase } from './public-status';
import './corrections.css';

void React;

export type ReceiptBlockProps = {
  readonly receiptCode: string;
  /** Absent immediately after submission, when the only true statement is "received". */
  readonly phase?: PublicCorrectionPhase;
  readonly submittedAt?: string;
  readonly updatedAt?: string;
};

export function ReceiptBlock({ receiptCode, phase, submittedAt, updatedAt }: ReceiptBlockProps) {
  const reached = phase ?? 'received';
  const inReview = reached === 'under_review' || reached === 'closed';
  const closed = reached === 'closed';

  return (
    <div className="ds-receipt">
      <div className="ds-receipt__code">
        <span className="ds-receipt__label">Receipt code</span>
        <span className="ds-receipt__value">{receiptCode}</span>
        <span className="ds-receipt__keep">
          Keep this. Without an email address on file, it is the only way to check the outcome.
        </span>
      </div>

      <ol className="ds-receipt__steps" aria-label="Where this correction has got to">
        <li>
          <UtilityStep
            index={1}
            title="Received"
            done
            {...(submittedAt ? { detail: submittedAt } : {})}
          />
        </li>
        <li>
          <UtilityStep
            index={2}
            title="In review"
            done={inReview}
            detail={
              inReview && updatedAt ? `Last moved ${updatedAt}` : 'Usually within ten working days'
            }
          />
        </li>
        <li>
          <UtilityStep
            index={3}
            title="Outcome"
            done={closed}
            /*
             * Neither line promises a reason on this page. `PublicCorrectionStatus` carries the
             * receipt, the phase and two timestamps, and nothing else: the outcome reason is not
             * part of the public payload, so "see the reason below" pointed at a paragraph that
             * does not exist. The commitment that a reason is given at all lives under the
             * receipt, where it belongs, and is a promise about being told rather than about
             * this page.
             */
            detail={closed ? 'Closed' : 'Published or declined'}
          />
        </li>
      </ol>
    </div>
  );
}
