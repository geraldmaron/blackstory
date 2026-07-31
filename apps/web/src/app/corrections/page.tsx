/**
 * Public corrections entry point. v9 utility room for quarantine-only intake
 * tied to entity/claim/source/location targets, with privacy notice and receipt codes.
 */
import type { Metadata } from 'next';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { CORRECTION_FORM_INTRO } from './copy';
import { CorrectionsSections } from './CorrectionsSections';
import { Room, RoomHeader } from '../../components/room';
import '../utility.css';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/corrections',
  title: 'Corrections',
  description: 'Challenge or correct a published BlackStory record through moderated review.',
});

export default function CorrectionsPage() {
  return (
    <Room>
      <RoomHeader
        pathname="/corrections"
        kicker="Trust"
        title="Corrections"
        lede={CORRECTION_FORM_INTRO}
      />
      <CorrectionsSections />
    </Room>
  );
}
