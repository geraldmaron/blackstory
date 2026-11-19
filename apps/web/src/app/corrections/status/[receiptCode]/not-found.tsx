/** Unknown receipt code: the designed answer, served with a 404 status. */
import Link from 'next/link';
import { Button, PageHeader } from '@repo/ui';
import { parentCrumb, Room } from '../../../../components/room';
import { TrustMast, TrustSheet } from '../../../../components/trust';
import '../../../utility.css';
import '../../../../components/trust/trust.css';
import '../../../../components/forms/form-kit.css';

export default function ReceiptNotFound() {
  return (
    <Room
      width="wide"
      className="ds-trust-room"
      masthead={
        <TrustMast tone="sand" art={['contours']}>
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
