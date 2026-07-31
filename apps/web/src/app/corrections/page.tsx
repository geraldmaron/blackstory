/**
 * Public corrections entry point. v6 utility edition for quarantine-only intake
 * tied to entity/claim/source/location targets, with privacy notice and receipt codes.
 */
import type { Metadata } from 'next';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { CORRECTION_FORM_INTRO } from './copy';
import { CorrectionsSections } from './CorrectionsSections';
import { UtilityEditionIntro } from '../../components/patterns/utility-edition/UtilityEditionIntro';
import { UtilityEditionShell } from '../../components/patterns/utility-edition/UtilityEditionShell';
import '../../components/patterns/utility-edition/utility-edition.css';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/corrections',
  title: 'Corrections',
  description: 'Challenge or correct a published BlackStory record through moderated review.',
});

export default function CorrectionsPage() {
  return (
    <UtilityEditionShell editionKey="corrections">
      <UtilityEditionIntro kicker="Trust" title="Corrections" lede={CORRECTION_FORM_INTRO} />
      <CorrectionsSections />
    </UtilityEditionShell>
  );
}
