/**
 * Evidence attach — queue evidence against a research case (prepare or commit).
 */
import { EvidenceAttachForm } from './evidence-form';
import { DeskTitleBar } from '../../../admin/design-system/ui';
import { EVIDENCE_ATTACH_INTENT_COPY } from './evidence-intake-copy';
import '../../../admin/cases/case-queue.css';

export const metadata = {
  title: 'Attach evidence',
  description: 'Propose evidence against a research case. Commit writes to quarantine only.',
};

/** The header carries the first two sentences; the rest sits directly below it. */
const COPY_SENTENCES = EVIDENCE_ATTACH_INTENT_COPY.split(/(?<=\.)\s+/);
const leadCopy = COPY_SENTENCES.slice(0, 2).join(' ');
const restCopy = COPY_SENTENCES.slice(2).join(' ');

export default function EvidenceAttachPage() {
  return (
    <main className="ds-container ds-page" id="main">
      <DeskTitleBar eyebrow="Intake" title="Attach evidence" description={leadCopy} />
      {restCopy ? <p>{restCopy}</p> : null}
      <EvidenceAttachForm />
    </main>
  );
}
