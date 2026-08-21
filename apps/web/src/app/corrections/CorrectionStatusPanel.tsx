/**
 * Public correction status page. Shows coarse phases only never spam scores, campaign
 * flags, duplicate lists, or other moderation-sensitive metadata.
 */
import { EmptyState } from '@repo/ui';
import Link from 'next/link';
import type { PublicCorrectionStatus } from './public-status';
import { AppealForm } from './AppealForm';
import { AbuseReportForm } from './AbuseReportForm';
import { ReceiptBlock } from './ReceiptBlock';

export function CorrectionStatusPanel({ status }: { readonly status: PublicCorrectionStatus }) {
  return (
    <div className="ds-stack">
      <ReceiptBlock
        receiptCode={status.receiptCode}
        phase={status.phase}
        submittedAt={status.submittedAt}
        updatedAt={status.updatedAt}
      />

      <p className="ds-room-field__hint">
        Nothing you sent is public. If your correction is declined you get the reason, not silence.
        Volume of corrections never changes public confidence or publication; coordinated activity
        is reviewed separately and is not shown here. Accepted corrections appear in{' '}
        <Link href="/errata">Errata</Link> with the record they changed.
      </p>

      {status.appealAvailable ? (
        <section aria-labelledby="appeal-heading">
          <h2
            id="appeal-heading"
            className="ds-page__title"
            style={{ fontSize: 'var(--ds-text-lg)' }}
          >
            Appeal
          </h2>
          <AppealForm receiptCode={status.receiptCode} />
        </section>
      ) : (
        <EmptyState title="Appeal not available">
          Appeals are limited to one per receipt and only when a correction was closed or a
          classification dispute was resolved.
        </EmptyState>
      )}

      <section aria-labelledby="abuse-heading">
        <h2 id="abuse-heading" className="ds-page__title" style={{ fontSize: 'var(--ds-text-lg)' }}>
          Report abuse
        </h2>
        <AbuseReportForm receiptCode={status.receiptCode} />
      </section>
    </div>
  );
}
