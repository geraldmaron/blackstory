/**
 * Correction status page keyed by receipt code. Server-rendered lookup with no
 * moderation-sensitive fields and no enumeration of other submissions.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@repo/ui';
import { parentCrumb, Room } from '../../../../components/room';
import { TrustMast, TrustSheet } from '../../../../components/trust';
import '../../../utility.css';
import '../../../../components/trust/trust.css';
import '../../../../components/forms/form-kit.css';
import {
  buildDefaultCorrectionRouteDependencies,
  lookupPublicStatusByReceipt,
  resolveReceiptCodeFromPath,
} from '../../api/handler';
import { CorrectionStatusPanel } from '../../CorrectionStatusPanel';

export const metadata: Metadata = {
  title: 'Correction status',
  description: 'Check the public status of a submitted correction using your receipt code.',
  // A receipt is one person's submission: never in a search index, found or not.
  robots: { index: false, follow: false },
};

type PageProps = {
  readonly params: Promise<{ readonly receiptCode: string }>;
};

export default async function CorrectionStatusPage({ params }: PageProps) {
  const { receiptCode: rawReceiptCode } = await params;
  const receiptCode = resolveReceiptCodeFromPath(rawReceiptCode);
  const deps = await buildDefaultCorrectionRouteDependencies();
  const status = await lookupPublicStatusByReceipt(receiptCode, deps);

  // A real 404, not a 200 page that says "not found": the designed body is in not-found.tsx.
  if (!status) notFound();

  return (
    <Room
      width="wide"
      className="ds-trust-room"
      masthead={
        <TrustMast>
          <PageHeader
            display
            crumb={parentCrumb('/corrections/status')}
            linkAs={Link}
            title="Correction status"
            dek="Only what you need to track your submission. Moderation details stay restricted."
          />
        </TrustMast>
      }
    >
      <TrustSheet>
        <CorrectionStatusPanel status={status} />
      </TrustSheet>
    </Room>
  );
}
