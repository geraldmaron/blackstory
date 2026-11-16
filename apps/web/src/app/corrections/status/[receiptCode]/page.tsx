/**
 * Correction status page keyed by receipt code. Server-rendered lookup with no
 * moderation-sensitive fields and no enumeration of other submissions.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, PageHeader } from '@repo/ui';
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
};

type PageProps = {
  readonly params: Promise<{ readonly receiptCode: string }>;
};

export default async function CorrectionStatusPage({ params }: PageProps) {
  const { receiptCode: rawReceiptCode } = await params;
  const receiptCode = resolveReceiptCodeFromPath(rawReceiptCode);
  const deps = await buildDefaultCorrectionRouteDependencies();
  const status = await lookupPublicStatusByReceipt(receiptCode, deps);

  if (!status) {
    return (
      <Room
        width="wide"
        className="ds-trust-room"
        masthead={
          <TrustMast tone="sand">
            <PageHeader
              display
              crumb={parentCrumb('/corrections/status')}
              linkAs={Link}
              title="Receipt not found"
              dek="No correction matches that code. There is no way to browse other people’s submissions."
            />
          </TrustMast>
        }
      >
        <TrustSheet>
          <p className="ds-trust-lead">
            Check the code against the one you were given. It starts with BB-COR and has sixteen
            letters and numbers after that.
          </p>
          <div className="ds-receipt-missing">
            <Button href="/corrections/status">Try another code</Button>
            <Button href="/corrections" variant="quiet">
              Send a new correction
            </Button>
          </div>
        </TrustSheet>
      </Room>
    );
  }

  return (
    <Room
      width="wide"
      className="ds-trust-room"
      masthead={
        <TrustMast tone="sand">
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
