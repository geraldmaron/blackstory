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
    <main className="ds-container ds-prose ds-page quick-add-page" id="main">
      <p className="ds-page__eyebrow">Intake</p>
      <h1 className="ds-page__title">Quick add</h1>
      <p className="ds-page__lede">
        Paste a source URL to fetch through the safe-fetch policy, pre-fill citation metadata, and
        prepare a draft research case in the quarantine pipeline. This desk proposes intake only —
        it does not publish, activate releases, or edit canonical catalog records.
      </p>
      <QuickAddForm />
      <p className="quick-add-footer">
        <Link href="/">Back to operations</Link>
        {' · '}
        <Link href="/inbox">Open inbox</Link>
      </p>
    </main>
  );
}
