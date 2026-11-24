/** Unknown receipt code: the designed answer, served with a 404 status. */
import Link from 'next/link';
import { Button, PageHeader } from '@repo/ui';
import { parentCrumb, PageFrame } from '../../../../components/page';
import { TrustMast, TrustSheet } from '../../../../components/trust';
import '../../../utility.css';
import '../../../../components/trust/trust.css';
import '../../../../components/forms/form-kit.css';

export default function ReceiptNotFound() {
  return (
    <PageFrame
      width="wide"
      className="ds-trust-doc"
      masthead={
        <TrustMast>
          <PageHeader
            display
            crumb={parentCrumb('/corrections/status')}
            linkAs={Link}
            title="Receipt not found"
            dek="No correction matches that code, which starts with BB-COR and has sixteen letters and numbers after it."
          />
        </TrustMast>
      }
    >
      <TrustSheet>
        <div className="ds-receipt-missing">
          <Button href="/corrections/status">Try another code</Button>
          <Button href="/corrections" variant="quiet">
            Send a new correction
          </Button>
        </div>
      </TrustSheet>
    </PageFrame>
  );
}
