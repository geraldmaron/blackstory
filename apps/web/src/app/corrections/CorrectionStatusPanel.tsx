/**
 * Public correction status page. Shows coarse phases only never spam scores, campaign
 * flags, duplicate lists, or other moderation-sensitive metadata.
 */
import { EmptyState, Notice } from '@repo/ui';
import { PUBLIC_STATUS_LABELS } from './copy';
import type { PublicCorrectionStatus } from './public-status';
import { AppealForm } from './AppealForm';
import { AbuseReportForm } from './AbuseReportForm';

export function CorrectionStatusPanel({ status }: { readonly status: PublicCorrectionStatus }) {
  return (
    <div className="ds-stack">
      <Notice tone="warning" title="Status">
        <dl className="ds-sans">
          <div>
            <dt>Receipt</dt>
            <dd>
              <code>{status.receiptCode}</code>
            </dd>
          </div>
          <div>
            <dt>Phase</dt>
            <dd>{PUBLIC_STATUS_LABELS[status.phase]}</dd>
          </div>
          <div>
            <dt>Submitted</dt>
            <dd>
              <time dateTime={status.submittedAt}>{status.submittedAt}</time>
            </dd>
          </div>
          <div>
            <dt>Last updated</dt>
            <dd>
              <time dateTime={status.updatedAt}>{status.updatedAt}</time>
            </dd>
          </div>
        </dl>
        <p style={{ marginTop: 'var(--ds-space-3)' }}>
          Volume of corrections never changes public confidence or publication. Coordinated activity
          is reviewed separately and is not shown here.
        </p>
      </Notice>

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
