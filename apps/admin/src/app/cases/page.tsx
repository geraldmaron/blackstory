/**
 * All research cases browser — every workflow state, not only inbox.
 */
import { CaseQueue } from '../../cases/CaseQueue';

export const metadata = {
  title: 'Research cases — BlackStory Admin',
  description: 'Browse and manage research cases across all workflow states.',
};

export default function CasesPage() {
  return (
    <main className="ds-container ds-page" id="main">
      <CaseQueue mode="cases" />
    </main>
  );
}
