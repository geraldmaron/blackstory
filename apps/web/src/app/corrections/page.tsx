/**
 * Corrections intake placeholder until BB-055 / submissions API land.
 */

import { EmptyState, Notice } from '@black-book/ui';

export const metadata = {
  title: 'Corrections',
  description: 'How to challenge or correct a published Black Book record (scaffold).',
};

export default function CorrectionsPage() {
  return (
    <main className="bb-container bb-page" id="main">
      <p className="bb-page__eyebrow">Trust</p>
      <h1 className="bb-page__title">Corrections</h1>
      <p className="bb-page__lede">
        Published records should be challengeable. Correction intake, quarantine, and promotion
        workflows land with BB-055 and the submissions API — this page is the public entry scaffold.
      </p>

      <div className="bb-stack" style={{ marginTop: 'var(--bb-space-6)' }}>
        <Notice tone="warning" title="Intake form not connected">
          Do not submit personal data here yet. The live correction experience will require explicit
          consent, quarantine scanning, and human review before any public change.
        </Notice>

        <EmptyState
          title="Correction form coming soon"
          action={
            <a className="bb-button bb-button--secondary" href="/methodology">
              Read how disputes are handled
            </a>
          }
        >
          When wired, you will be able to challenge a claim, suggest missing evidence, or report a
          living-person precision issue. Nothing on this page writes to production today.
        </EmptyState>
      </div>
    </main>
  );
}
