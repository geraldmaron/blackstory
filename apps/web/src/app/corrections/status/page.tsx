/**
 * Correction status landing page. `/corrections/status` with no receipt code — reached by
 * bookmark, by typing the URL, or by `CorrectionsSections`' own "Check a receipt" link, which
 * point here rather than at a specific `[receiptCode]`. Previously 404ed: this repo-vl155.2 fix
 * gives it a real page (a receipt-code form) matching the sibling `[receiptCode]/page.tsx` and
 * the rest of the utility-room pages (errata, methodology, terms) instead of a dead end.
 */
import type { Metadata } from 'next';
import { buildStaticPageMetadata } from '../../../lib/seo/metadata-builders';
import { Room, ReadingEntry } from '../../../components/room';
import '../../utility.css';
import { ReceiptLookupForm } from './ReceiptLookupForm';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/corrections/status',
  title: 'Check a correction receipt',
  description: 'Look up the status of a submitted correction using your receipt code.',
});

export default function CorrectionStatusLandingPage() {
  return (
    <Room>
      <ReadingEntry
        pathname="/corrections/status"
        title="Check a correction receipt"
        lede="Enter the receipt code you were given when you submitted a correction. There is no way to browse other people’s submissions."
      />
      <ReceiptLookupForm />
    </Room>
  );
}
