/**
 * correction status page keyed by receipt code. v9 utility room; server-rendered
 * lookup with no moderation-sensitive fields and no enumeration of other submissions.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState, Notice } from '@repo/ui';
import { Room, RoomHeader } from '../../../../components/room';
import '../../../utility.css';
import {
  buildDefaultCorrectionRouteDependencies,
  lookupPublicStatusByReceipt,
  resolveReceiptCodeFromPath,
} from '../../api/handler';
import { CorrectionStatusPanel } from '../../CorrectionStatusPanel';

export const metadata: Metadata = {
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
      <Room>
        <RoomHeader pathname="/corrections/status" kicker="Trust" title="Correction status" />
        <Notice tone="error" title="Receipt not found">
          No correction matches that receipt code. Check the code and try again. There is no way to
          browse other people’s submissions.
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
      </Room>
    );
  }

  return (
    <Room>
      <RoomHeader
        pathname="/corrections/status"
        kicker="Trust"
        title="Correction status"
        lede="This page shows only what you need to track your submission. Moderation details stay restricted."
      />
      <CorrectionStatusPanel status={status} />
    </Room>
  );
}
