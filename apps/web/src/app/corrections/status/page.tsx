/**
 * Correction status landing page. `/corrections/status` with no receipt code — reached by
 * bookmark, by typing the URL, or by `CorrectionsSections`' own "Check a receipt" link, which
 * point here rather than at a specific `[receiptCode]`. Previously 404ed: this repo-vl155.2 fix
 * gives it a real page (a receipt-code form) matching the sibling `[receiptCode]/page.tsx` and
 * the rest of the utility-room pages (errata, methodology, terms) instead of a dead end.
 */
import type { Metadata } from 'next';
import { buildStaticPageMetadata } from '../../../lib/seo/metadata-builders';
import Link from 'next/link';
import { PageHeader } from '@repo/ui';
import { parentCrumb, Room } from '../../../components/room';
import { TrustMast, TrustSheet } from '../../../components/trust';
import '../../utility.css';
import '../../../components/trust/trust.css';
import '../../../components/forms/form-kit.css';
import { ReceiptLookupForm } from './ReceiptLookupForm';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/corrections/status',
  title: 'Check a correction receipt',
  description: 'Look up the status of a submitted correction using your receipt code.',
});

export default function CorrectionStatusLandingPage() {
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
            title="Check a correction receipt"
            dek="Enter the code you were given when you sent a correction. There is no way to browse other people’s submissions."
          />
        </TrustMast>
      }
    >
      <TrustSheet>
        <ReceiptLookupForm />
        <p className="ds-trust-foot">
          No code? <Link href="/corrections">Send a correction</Link> to get one.
        </p>
      </TrustSheet>
    </Room>
  );
}
