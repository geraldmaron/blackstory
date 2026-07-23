/**
 * Public corrections entry point. v6 utility edition for quarantine-only intake
 * tied to entity/claim/source/location targets, with privacy notice and receipt codes.
 */
import { CORRECTION_FORM_INTRO } from './copy';
import { CorrectionsSections } from './CorrectionsSections';
import { UtilityEditionIntro } from '../../components/patterns/utility-edition/UtilityEditionIntro';
import { UtilityEditionShell } from '../../components/patterns/utility-edition/UtilityEditionShell';
import '../../components/patterns/utility-edition/utility-edition.css';

export const metadata = {
  title: 'Corrections',
  description: 'Challenge or correct a published BlackStory record through moderated review.',
};

export default function CorrectionsPage() {
  return (
    <UtilityEditionShell mosaicSeed="corrections-edition-v6" editionKey="corrections">
      <UtilityEditionIntro
        kicker="Trust"
        title="Corrections"
        lede={CORRECTION_FORM_INTRO}
      />
      <CorrectionsSections />
    </UtilityEditionShell>
  );
}
