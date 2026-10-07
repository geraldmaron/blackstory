/**
 * Public corrections entry point. v9 utility room for quarantine-only intake
 * tied to entity/claim/source/location targets, with privacy notice and receipt codes.
 */
import type { Metadata } from 'next';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { CorrectionsSections } from './CorrectionsSections';
import { Room, ReadingEntry } from '../../components/room';
import { resolvePublicEntityView } from '../../lib/public-data/source';
import { isCorrectionTargetType } from './categories';
import '../utility.css';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/corrections',
  title: 'Corrections',
  description:
    'Say a published BlackStory record is wrong. Moderated review, receipt code, tracked outcome.',
});

type CorrectionsPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CorrectionsPage({ searchParams }: CorrectionsPageProps) {
  const query = await searchParams;
  const target = typeof query.target === 'string' ? query.target.trim() : '';
  const hasControlCharacter = Array.from(target).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
  const initialTarget = target.length <= 128 && !hasControlCharacter ? target : '';
  const initialTargetType =
    typeof query.targetType === 'string' && isCorrectionTargetType(query.targetType)
      ? query.targetType
      : 'entity';
  // A catalog outage must not prevent someone from filing a correction.
  const record =
    initialTarget && initialTargetType === 'entity'
      ? await resolvePublicEntityView(initialTarget).catch(() => undefined)
      : undefined;
  return (
    <Room ledger>
      <ReadingEntry
        pathname="/corrections"
        title={
          <>
            Tell the archive it&apos;s <em>wrong</em>.
          </>
        }
        lede="You get a receipt code and a tracked outcome. A person reads every correction, and nothing you send publishes on arrival."
      />
      <CorrectionsSections
        key={`${initialTargetType}:${initialTarget}`}
        initialTarget={initialTarget}
        initialTargetType={initialTargetType}
        {...(record?.data ? { targetName: record.data.displayName } : {})}
      />
    </Room>
  );
}
