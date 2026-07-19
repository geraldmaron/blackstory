/**
 * Public corrections entry point. Challenge published records through quarantine-only
 * intake tied to entity/claim/source/location targets, with privacy notice and receipt codes.
 */
import { Suspense } from 'react';
import { EmptyState, Notice } from '@repo/ui';
import { CorrectionForm } from './CorrectionForm';
import { CORRECTION_FORM_INTRO, CORRECTION_PRIVACY_NOTICE } from './copy';

export const metadata = {
  title: 'Corrections',
  description: 'Challenge or correct a published BlackStory record through moderated review.',
};

export default function CorrectionsPage() {
  return (
    <main className="ds-container ds-page" id="main">
      <p className="ds-page__eyebrow">Trust</p>
      <h1 className="ds-page__title">Corrections</h1>
      <p className="ds-page__lede">{CORRECTION_FORM_INTRO}</p>

      <div className="ds-stack" style={{ marginTop: 'var(--ds-space-6)' }}>
        <Notice tone="warning" title="This is not a public post">
          Corrections enter a restricted quarantine queue for human review. Nothing you
          submit changes the public record until it passes independent review and promotion
          controls. {CORRECTION_PRIVACY_NOTICE.body}
        </Notice>

        <Suspense fallback={<p className="ds-sans">Loading correction form…</p>}>
          <CorrectionForm />
        </Suspense>

        <EmptyState title="What happens after you submit">
          You receive a receipt code — the only way to check status. Moderators review every
          correction; coordinated volume never alters confidence or publication. Read{' '}
          <a href="/methodology">how disputes and review are handled</a>.
        </EmptyState>
      </div>
    </main>
  );
}
