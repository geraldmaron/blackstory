/**
 * Quick-add: paste a URL, fetch it through safety, and open a draft research case
 * through the same operator-cli package functions as `submit-lead`/`research-intake`.
 */
import Link from 'next/link';
import { QuickAddForm } from './quick-add-form';
import './quick-add.css';

export const metadata = {
  title: 'Quick add — BlackStory Admin',
  description: 'Paste a URL and open a draft research case through the operator proposal lane.',
};

export default function QuickAddPage() {
  return (
    <main className="ds-container ds-prose quick-add-page">
      <p className="quick-add-kicker">Operator proposal lane</p>
      <h1>Quick add</h1>
      <p>
        Paste a source URL. It fetches through the safe-fetch policy (DNS-pinned, SSRF-
        safe, sandboxed), pre-fills citation metadata, notes the archival capture point, and
        prepares a draft research case in the same quarantine pipeline every other
        proposer uses. Nothing is published from here — proposing and publishing stay distinct,
        separately authorized actions.
      </p>
      <QuickAddForm />
      <p className="quick-add-footer">
        <Link href="/console">Back to the administration console</Link>
      </p>
    </main>
  );
}
