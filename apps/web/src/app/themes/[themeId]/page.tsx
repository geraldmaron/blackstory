/**
 * Theme-impact detail page at `/themes/[themeId]` — canonical questions with fixture packets.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ThemeImpactMapStrip } from '../../../components/theme-impact/ThemeImpactMapStrip';
import { ThemeImpactPacketCard } from '../../../components/theme-impact/ThemeImpactPacketCard';
import { ThemeImpactStoryEmbed } from '../../../components/theme-impact/ThemeImpactStoryEmbed';
import {
  getThemeCatalogEntry,
  listAvailableThemeIds,
  listPacketsForTheme,
} from '../../../components/theme-impact/fixtures';
import '../../../components/theme-impact/theme-impact.css';

type ThemeDetailPageProps = {
  readonly params: Promise<{ readonly themeId: string }>;
};

export async function generateStaticParams() {
  return listAvailableThemeIds().map((themeId) => ({ themeId }));
}

export async function generateMetadata({ params }: ThemeDetailPageProps) {
  const { themeId } = await params;
  const entry = getThemeCatalogEntry(themeId);
  if (!entry?.available) {
    return { title: 'Theme not found' };
  }
  return {
    title: entry.title,
    description: entry.lede,
  };
}

export default async function ThemeDetailPage({ params }: ThemeDetailPageProps) {
  const { themeId } = await params;
  const entry = getThemeCatalogEntry(themeId);

  if (!entry?.available) {
    notFound();
  }

  const packets = listPacketsForTheme(themeId);

  return (
    <main className="ds-container ds-page" id="main">
      <p className="ds-page__eyebrow">Theme · {entry.priority}</p>
      <h1 className="ds-page__title">{entry.title}</h1>
      <p className="ds-page__lede">{entry.lede}</p>

      <div className="ds-theme-impact">
        <aside className="ds-theme-impact__notice" aria-labelledby="theme-detail-method-heading">
          <h2 className="ds-theme-impact__notice-title" id="theme-detail-method-heading">
            Juxtaposition, not causation
          </h2>
          <p className="ds-theme-impact__notice-body">
            Each packet below states its method stance and any gap labels. Policy timing beside an
            indicator is not proof of cause. See{' '}
            <Link href="/methodology">methodology</Link> for the full juxtaposition bar.
          </p>
        </aside>

        {themeId === 'redlining' ? (
          <section
            className="ds-section ds-record-section ds-section--flush"
            aria-labelledby="theme-consumers-heading"
            id="consumers"
          >
            <p className="ds-section__kicker">
              <span className="ds-kicker-index" aria-hidden="true" />
              Pilot consumers
            </p>
            <h2 className="ds-section__title" id="theme-consumers-heading">
              Story embed and map strip
            </h2>
            <p className="ds-section__lede">
              Both surfaces read the same Chicago redlining packet fixture — indicators, citations,
              and juxtaposition method note — before full story and map wiring ships.
            </p>
            <div className="ds-theme-impact__consumers">
              <div className="ds-theme-impact__consumer-block">
                <p className="ds-theme-impact__consumer-label">Story embed</p>
                <ThemeImpactStoryEmbed headingId="redlining-story-embed" />
              </div>
              <div className="ds-theme-impact__consumer-block">
                <p className="ds-theme-impact__consumer-label">Map context strip</p>
                <ThemeImpactMapStrip labelId="redlining-map-strip" />
              </div>
            </div>
          </section>
        ) : null}

        <section
          className="ds-section ds-record-section ds-section--flush"
          aria-labelledby="theme-packets-heading"
          id="packets"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            Canonical questions
          </p>
          <h2 className="ds-section__title" id="theme-packets-heading">
            {packets.length} question{packets.length === 1 ? '' : 's'} in scope
          </h2>
          <p className="ds-section__lede">
            Fixture packets mirror the upcoming live shape — citations, provenance quartet, artifacts,
            and explicit insufficient-evidence or modeled labels where applicable.
          </p>

          <ul className="ds-theme-impact__packets" aria-label={`${entry.title} question packets`}>
            {packets.map((packet) => (
              <li key={packet.questionId}>
                <ThemeImpactPacketCard packet={packet} />
              </li>
            ))}
          </ul>
        </section>

        <p className="ds-theme-impact__back">
          <Link href="/themes">← All themes</Link>
        </p>
      </div>
    </main>
  );
}
