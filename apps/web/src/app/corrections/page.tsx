/**
 * Public corrections entry point: quarantine-only intake tied to entity, claim, source or
 * location targets, with a privacy notice and receipt codes.
 */
import type { Metadata } from 'next';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { CorrectionsSections } from './CorrectionsSections';
import Link from 'next/link';
import { PageHeader } from '@repo/ui';
import { parentCrumb, Room } from '../../components/room';
import { TrustMast, TrustSheet } from '../../components/trust';
import { resolvePublicEntityView } from '../../lib/public-data/source';
import { isCorrectionTargetType } from './categories';
import '../utility.css';
import '../../components/forms/form-kit.css';
import './corrections.css';

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
    <Room
      width="wide"
      className="ds-trust-room"
      masthead={
        <TrustMast art={['tools']}>
          <PageHeader
            display
            crumb={parentCrumb('/corrections')}
            linkAs={Link}
            title="Tell the archive it's wrong"
            dek="A person reads every correction, and you get a receipt code to track the outcome."
          />
        </TrustMast>
      }
    >
      <TrustSheet>
        <CorrectionsSections
          key={`${initialTargetType}:${initialTarget}`}
          initialTarget={initialTarget}
          initialTargetType={initialTargetType}
          {...(record?.data ? { targetName: record.data.displayName } : {})}
        />
      </TrustSheet>
    </Room>
  );
}
