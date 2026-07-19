/**
 * Inbox — unified pending research work queue with live transitions.
 */
import { CaseQueue } from '../../cases/CaseQueue';

export const metadata = {
  title: 'Inbox — BlackStory Admin',
  description: 'Triage pending research cases with full detail and live decisions.',
};

export default function InboxPage() {
  return (
    <main className="ds-container ds-page" id="main">
      <CaseQueue mode="inbox" />
    </main>
  );
}
