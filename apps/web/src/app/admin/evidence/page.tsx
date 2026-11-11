/**
 * Evidence attach — queue evidence against a research case (prepare or commit).
 * `?case=<id>` opens the form with that case filled in, as the case page links it.
 */
import { EvidenceAttachForm } from './evidence-form';
import { DeskTitleBar } from '../../../admin/design-system/ui';
import { tryListAdminResearchCases } from '../../../admin/cases/research-case-store';
import { EVIDENCE_ATTACH_INTENT_COPY } from './evidence-intake-copy';
import '../../../admin/cases/case-queue.css';
import '../quick-add/quick-add.css';

export const metadata = {
  title: 'Attach evidence',
  description: 'Propose evidence against a research case. Commit writes to quarantine only.',
};

export const dynamic = 'force-dynamic';

/** The store caps a list at 200; the field still accepts any case id typed in full. */
const CASE_SUGGESTION_LIMIT = 200;

export default async function EvidenceAttachPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).case;
  const defaultCaseId = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? '';
  const cases = (await tryListAdminResearchCases({ limit: CASE_SUGGESTION_LIMIT })) ?? [];

  return (
    <main className="ds-container ds-prose ds-page quick-add-page" id="main">
      <DeskTitleBar
        eyebrow="Intake"
        title="Attach evidence"
        description={EVIDENCE_ATTACH_INTENT_COPY}
      />
      <EvidenceAttachForm
        cases={cases.map((c) => ({ id: c.id, title: c.title }))}
        defaultCaseId={defaultCaseId}
      />
    </main>
  );
}
