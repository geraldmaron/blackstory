/**
 * Public theme-impact browse page at `/themes` — P0 themes with live or fixture packets,
 * P1 themes labeled coming soon, and a link to methodology for juxtaposition rules.
 */

import Link from 'next/link';
import { ThemeBrowseSections } from './ThemeBrowseSections';
import '../../components/theme-impact/theme-impact.css';

export const metadata = {
  title: 'Themes',
  description:
    'Standalone theme-impact browse for redlining and drug policy & the state — canonical questions with cited fixtures, gap labels, and juxtaposition-not-causation method notes.',
};

export default function ThemesBrowsePage() {
  return (
    <main className="ds-container ds-page" id="main">
      <p className="ds-page__eyebrow">Impact</p>
      <h1 className="ds-page__title">Themes</h1>
      <p className="ds-page__lede">
        Policy eras, geography, and evidence packets for major through-lines in the archive.
        Figures sit beside artifacts — juxtaposed, not collapsed into causal claims.
      </p>
      <p>
        <Link className="ds-cta-link" href="/books">
          Related: banned books catalog
        </Link>
      </p>
      <ThemeBrowseSections />
    </main>
  );
}
