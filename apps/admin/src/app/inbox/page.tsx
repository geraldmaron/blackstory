/**
 * Inbox — pending research-case triage queue (candidate, relevance review, needs evidence).
 */
import { CaseQueue } from '../../cases/CaseQueue';

export const metadata = {
  title: 'Inbox — BlackStory Admin',
  description: 'Work the pending research-case queue before anything publishes.',
};

export default function InboxPage() {
  return (
    <main className="ds-container ds-page" id="main">
      <CaseQueue mode="inbox" />
    </main>
  );
}
