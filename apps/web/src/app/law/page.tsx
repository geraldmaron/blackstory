/**
 * Public law reference browse surface at `/law`.
 *
 * v6 edition Surface stack with shared gutter mosaic atmosphere. Preserves GET
 * browse URL contract (`q`, `kind`, `topic`) and auto-submit facet selects.
 */
import Link from 'next/link';
import { ATMOSPHERE_ATTRIBUTION_HREF } from '../../components/atmosphere/tile-credits';
import { LAW_EDITION_BROWSE_LEDE } from './law-copy';
import { buildLawBrowseViewModel, type RawLawBrowseParams } from './law-view-model';
import { loadLegalCatalog } from '../../lib/legal/public-source';
import { LawBrowseSections } from './LawBrowseSections';
import {
  lawEditionPanelClassName,
  lawEditionRootClassName,
  lawEditionStackClassName,
} from './law-panel-chrome';
import './law-edition.css';

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
  const view = buildLawBrowseViewModel(params, await loadLegalCatalog());

  return (
    <div className={lawEditionRootClassName()} data-law-edition="v6">
      <main className="ds-container ds-page" id="main">
        <div className={lawEditionStackClassName()}>
          <article className={lawEditionPanelClassName('intro')}>
            <header className="ds-law-edition__header">
              <span className="ds-law-edition__index" aria-hidden="true">
                00
              </span>
              <div>
                <p className="ds-law-edition__kicker">Reference</p>
                <h1 className="ds-law-edition__title">
                  Civil rights <em>law</em>
                </h1>
                <p className="ds-law-edition__lede">{LAW_EDITION_BROWSE_LEDE}</p>
                <p className="ds-law-edition__credit">
                  Archive texture · symbolic atmosphere. {' '}
                  <Link href={ATMOSPHERE_ATTRIBUTION_HREF}>Mosaic credits</Link>
                </p>
              </div>
            </header>
          </article>

          <LawBrowseSections view={view} />
        </div>
      </main>
    </div>
  );
}
