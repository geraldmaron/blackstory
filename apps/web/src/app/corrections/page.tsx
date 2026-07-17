/**
 * Public corrections entry point. Challenge published records through quarantine-only
 * intake tied to entity/claim/source/location targets, with privacy notice and receipt codes.
 */
import { Suspense } from 'react';
import { EmptyState, Notice } from '@black-book/ui';
import { SeedDataNotice } from '../../components/SeedDataNotice';
import { CorrectionForm } from './CorrectionForm';
import { CORRECTION_FORM_INTRO, CORRECTION_PRIVACY_NOTICE } from './copy';

export const metadata = {
  title: 'Corrections',
  description: 'Challenge or correct a published Black Book record through moderated review.',
};

export default function CorrectionsPage() {
  return (
    <main className="bb-container bb-page" id="main">
      <p className="bb-page__eyebrow">Trust</p>
      <h1 className="bb-page__title">Corrections</h1>
      <p className="bb-page__lede">{CORRECTION_FORM_INTRO}</p>

      <div className="bb-stack" style={{ marginTop: 'var(--bb-space-6)' }}>
        <SeedDataNotice compact />

        <Notice tone="warning" title="This is not a public post">
          Corrections enter a restricted quarantine queue (BB-029) for human review. Nothing you
          submit changes the public record until it passes independent review and promotion controls
          (BB-032). {CORRECTION_PRIVACY_NOTICE.body}
        </Notice>

        <Suspense fallback={<p className="bb-sans">Loading correction form…</p>}>
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
