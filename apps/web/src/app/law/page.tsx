/**
 * Public law reference browse surface at `/law`.
 */
import { LAW_BROWSE_LEDE } from '../../components/legal';
import { buildLawBrowseViewModel, type RawLawBrowseParams } from './law-view-model';
import { LawBrowseSections } from './LawBrowseSections';

export const metadata = {
  title: 'Law',
  description:
    'Plain-language access to landmark civil-rights statutes, regulations, and court decisions.',
};

type LawPageProps = {
  readonly searchParams: Promise<RawLawBrowseParams>;
};

export default async function LawBrowsePage({ searchParams }: LawPageProps) {
  const params = await searchParams;
  const view = buildLawBrowseViewModel(params);

  return (
    <main className="ds-container ds-page" id="main">
      <p className="ds-page__eyebrow">Reference</p>
      <h1 className="ds-page__title">Law</h1>
      <p className="ds-page__lede">{LAW_BROWSE_LEDE}</p>
      <LawBrowseSections view={view} />
    </main>
  );
}
