/**
 * correction status page keyed by receipt code. Server-rendered lookup with no
 * moderation-sensitive fields and no enumeration of other submissions.
 */
import { EmptyState, Notice } from '@repo/ui';
import {
  buildDefaultCorrectionRouteDependencies,
  lookupPublicStatusByReceipt,
  resolveReceiptCodeFromPath,
} from '../../api/handler';
import { CorrectionStatusPanel } from '../../CorrectionStatusPanel';

export const metadata = {
  title: 'Correction status',
  description: 'Check the public status of a submitted correction using your receipt code.',
};

type PageProps = {
  readonly params: Promise<{ readonly receiptCode: string }>;
};

export default async function CorrectionStatusPage({ params }: PageProps) {
  const { receiptCode: rawReceiptCode } = await params;
  const receiptCode = resolveReceiptCodeFromPath(rawReceiptCode);
  const deps = await buildDefaultCorrectionRouteDependencies();
  const status = lookupPublicStatusByReceipt(receiptCode, deps);

  if (!status) {
    return (
      <main className="ds-container ds-page" id="main">
        <h1 className="ds-page__title">Correction status</h1>
        <Notice tone="error" title="Receipt not found">
          We could not find a correction with that receipt code. Check the code and try again —
          there is no way to browse other submissions.
        </Notice>
        <EmptyState
          title="Need to submit a correction?"
          action={
            <a className="ds-button ds-button--secondary" href="/corrections">
              Go to corrections
            </a>
          }
        >
          Start from the corrections page if you do not yet have a receipt code.
        </EmptyState>
      </main>
    );
  }

  return (
    <main className="ds-container ds-page" id="main">
      <p className="ds-page__eyebrow">Trust</p>
      <h1 className="ds-page__title">Correction status</h1>
      <p className="ds-page__lede">
        This page shows only what you need to track your submission. Moderation details stay
        restricted.
      </p>
      <div style={{ marginTop: 'var(--ds-space-6)' }}>
        <CorrectionStatusPanel status={status} />
      </div>
    </main>
  );
}
