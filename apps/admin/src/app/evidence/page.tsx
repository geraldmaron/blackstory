/**
 * Evidence attach — queue evidence against a research case (prepare or commit).
 */
import { EvidenceAttachForm } from './evidence-form';
import { EVIDENCE_ATTACH_INTENT_COPY } from './evidence-intake-copy';
import '../../cases/case-queue.css';

export const metadata = {
  title: 'Attach evidence — BlackStory Admin',
  description: 'Propose evidence against a research case. Commit writes to quarantine only.',
};

export default function EvidenceAttachPage() {
  return (
    <main className="ds-container ds-page" id="main">
      <p className="ds-page__eyebrow">Intake</p>
      <h1 className="ds-page__title">Attach evidence</h1>
      <p className="ds-page__lede">{EVIDENCE_ATTACH_INTENT_COPY}</p>
      <EvidenceAttachForm />
    </main>
  );
}
