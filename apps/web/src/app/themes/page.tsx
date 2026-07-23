/**
 * Public theme-impact browse page at `/themes`. v6 edition Surface stack with shared
 * gutter mosaic atmosphere; P0 live themes and P1 coming soon with method notice.
 */

import Link from 'next/link';
import { ATMOSPHERE_ATTRIBUTION_HREF } from '../../components/atmosphere/tile-credits';
import { EditionAtmosphereMosaic } from '../../components/patterns/edition-atmosphere/EditionAtmosphereMosaic';
import {
  EDITION_MOSAIC_COUNT_BROWSE,
} from '../../components/patterns/edition-atmosphere/edition-atmosphere-config';
import { ThemeBrowseSections } from './ThemeBrowseSections';
import {
  THEMES_EDITION_MOSAIC_SEED,
  themesEditionPanelClassName,
  themesEditionRootClassName,
  themesEditionStackClassName,
} from './themes-panel-chrome';
import './themes-edition.css';
import '../../components/theme-impact/theme-impact.css';

export const metadata = {
  title: 'Themes',
  description:
    'Evidence-led theme articles on redlining, drug policy, urban renewal, mass incarceration, and unequal environmental burden.',
};

export default function ThemesBrowsePage() {
  return (
    <div className={themesEditionRootClassName()} data-themes-edition="v6">
      <EditionAtmosphereMosaic seedKey={THEMES_EDITION_MOSAIC_SEED} count={EDITION_MOSAIC_COUNT_BROWSE} />
      <main className="ds-container ds-page" id="main">
        <div className={themesEditionStackClassName()}>
          <article className={themesEditionPanelClassName('intro')}>
            <header className="ds-themes-edition__header">
              <span className="ds-themes-edition__index" aria-hidden="true">
                00
              </span>
              <div>
                <p className="ds-themes-edition__kicker">Impact</p>
                <h1 className="ds-themes-edition__title">
                  Policy eras beside <em>evidence</em>.
                </h1>
                <p className="ds-themes-edition__lede">
                  Policy eras, geography, and evidence packets for major through-lines in the
                  archive. Figures sit beside artifacts, juxtaposed, not collapsed into causal
                  claims.
                </p>
                <p className="ds-themes-edition__crosslink">
                  <Link className="ds-cta-link" href="/books">
                    Related: banned books catalog
                  </Link>
                </p>
                <p className="ds-themes-edition__credit">
                  Archive mosaic · symbolic atmosphere · decorative gutter tiles only.{' '}
                  <Link href={ATMOSPHERE_ATTRIBUTION_HREF}>Mosaic credits</Link>
                </p>
              </div>
            </header>
          </article>

          <ThemeBrowseSections />
        </div>
      </main>
    </div>
  );
}
