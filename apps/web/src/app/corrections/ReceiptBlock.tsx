/**
 * The receipt: the code, and where the correction stands.
 *
 * Rendered on the status page and, with no phase yet, straight after a submission. It replaced a
 * bordered "Status" warning notice holding a definition list — a receipt is not a warning, and
 * the one thing on the screen a person has to keep was set at body size inside it.
 */
import React from 'react';
import { NumberedStep } from '../../components/forms/fields';
import { formatRecordDate } from '../../components/patterns/format-record-date';
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
  const submittedOn = formatRecordDate(submittedAt);
  const updatedOn = formatRecordDate(updatedAt);
  const reached = phase ?? 'received';
  const inReview = reached === 'under_review' || reached === 'closed';
  const closed = reached === 'closed';

  return (
    <div className="ds-receipt">
      {/*
       * The code is a `<code>` and the sentence after it is a `<p>`, not two adjacent spans.
       * As spans they ran together in the flat text — "BB-COR-…Keep this." — so anything
       * reading the page as text, including some assistive-tech reading modes and anyone
       * copying the code, got the next word stuck to the one thing a person has to keep.
       */}
      <div className="ds-receipt__code">
        <span className="ds-receipt__label">Receipt code</span>
        <code className="ds-receipt__value">{receiptCode}</code>
        <p className="ds-receipt__keep">
          Keep this code. It’s how you look up the outcome on this page.
        </p>
      </div>

      <ol className="ds-receipt__steps" aria-label="Where this correction stands">
        <li>
          <NumberedStep
            index={1}
            title="Received"
            done
            {...(submittedOn ? { detail: submittedOn } : {})}
          />
        </li>
        <li>
          <NumberedStep
            index={2}
            title="In review"
            done={inReview}
            detail={
              inReview && updatedOn ? `Updated ${updatedOn}` : 'Usually within ten working days'
            }
          />
        </li>
        <li>
          <NumberedStep
            index={3}
            title="Outcome"
            done={closed}
            /*
             * This step stays a generic label ("Closed") on purpose — it is the timeline, not
             * the explanation. `PublicCorrectionStatus.outcomeReason` carries the plain-language
             * decline reason and renders separately in `CorrectionStatusPanel`, not here.
             */
            detail={closed ? 'Closed' : 'Published or declined'}
          />
        </li>
      </ol>
    </div>
  );
}
