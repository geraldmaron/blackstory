/**
 * correction status page keyed by receipt code. v6 utility edition; server-rendered
 * lookup with no moderation-sensitive fields and no enumeration of other submissions.
 */
import Link from 'next/link';
import { EmptyState, Notice } from '@repo/ui';
import { UtilityEditionBodyPanel } from '../../../../components/patterns/utility-edition/UtilityEditionBodyPanel';
import { UtilityEditionIntro } from '../../../../components/patterns/utility-edition/UtilityEditionIntro';
import { UtilityEditionShell } from '../../../../components/patterns/utility-edition/UtilityEditionShell';
import '../../../../components/patterns/utility-edition/utility-edition.css';
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
      <UtilityEditionShell mosaicSeed="correction-status-edition-v6" editionKey="correction-status">
        <UtilityEditionIntro
          kicker="Trust"
          title="Correction status"
          variant="status"
        />
        <UtilityEditionBodyPanel>
          <Notice tone="error" title="Receipt not found">
            We could not find a correction with that receipt code. Check the code and try again —
            there is no way to browse other submissions.
          </Notice>
          <EmptyState
            title="Need to submit a correction?"
            action={
              <Link className="ds-button ds-button--secondary" href="/corrections">
                Go to corrections
              </Link>
            }
          >
            Start from the corrections page if you do not yet have a receipt code.
          </EmptyState>
        </UtilityEditionBodyPanel>
      </UtilityEditionShell>
    );
  }

  return (
    <UtilityEditionShell mosaicSeed="correction-status-edition-v6" editionKey="correction-status">
      <UtilityEditionIntro
        kicker="Trust"
        title="Correction status"
        lede="This page shows only what you need to track your submission. Moderation details stay restricted."
      />
      <UtilityEditionBodyPanel>
        <CorrectionStatusPanel status={status} />
      </UtilityEditionBodyPanel>
    </UtilityEditionShell>
  );
}
