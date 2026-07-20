/**
 * Public corrections entry point. Challenge published records through quarantine-only
 * intake tied to entity/claim/source/location targets, with privacy notice and receipt codes.
 */
import { CORRECTION_FORM_INTRO } from './copy';
import { CorrectionsSections } from './CorrectionsSections';

export const metadata = {
  title: 'Corrections',
  description: 'Challenge or correct a published BlackStory record through moderated review.',
};

export default function CorrectionsPage() {
  return (
    <main className="ds-container ds-page" id="main">
      <p className="ds-page__eyebrow">Trust</p>
      <h1 className="ds-page__title">Corrections</h1>
      <p className="ds-page__lede" id="corrections-lede">
        {CORRECTION_FORM_INTRO}
      </p>
      <CorrectionsSections />
    </main>
  );
}
