/**
 * Question-level theme-impact page at `/themes/[themeId]/questions/[questionId]`.
 * v6 edition Surface stack with shared gutter mosaic and full packet card.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EditionAtmosphereMosaic } from '../../../../../components/patterns/edition-atmosphere/EditionAtmosphereMosaic';
import { ThemeImpactPacketCard } from '../../../../../components/theme-impact/ThemeImpactPacketCard';
import { ThemeImpactStorytellingPanel } from '../../../../../components/theme-impact/ThemeImpactStorytellingPanel';
import { getThemeCatalogEntry } from '../../../../../components/theme-impact/fixtures';
import { resolveThemeImpactPacketView } from '../../../../../lib/theme-impact/source';
import { shouldShowThemeImpactStorytelling } from '../../../../../lib/theme-impact/storytelling-series';
import {
  themesEditionMosaicSeedForTheme,
  themesEditionPanelClassName,
  themesEditionRootClassName,
  themesEditionStackClassName,
} from '../../../themes-panel-chrome';
import '../../../themes-edition.css';
import '../../../../../components/theme-impact/theme-impact.css';

type ThemeQuestionPageProps = {
  readonly params: Promise<{ readonly themeId: string; readonly questionId: string }>;
};

export async function generateMetadata({ params }: ThemeQuestionPageProps) {
  const { themeId, questionId } = await params;
  const entry = getThemeCatalogEntry(themeId);
  const packet = await resolveThemeImpactPacketView(themeId, questionId);
  if (!entry?.available || !packet) {
    return { title: 'Question not found' };
  }
  return {
    title: `${entry.title} · Question ${questionId}`,
    description: packet.question,
  };
}

export default async function ThemeQuestionPage({ params }: ThemeQuestionPageProps) {
  const { themeId, questionId } = await params;
  const entry = getThemeCatalogEntry(themeId);
  if (!entry?.available) {
    notFound();
  }

  const packet = await resolveThemeImpactPacketView(themeId, questionId);
  if (!packet) {
    notFound();
  }

  return (
    <div className={themesEditionRootClassName()} data-themes-edition="v6">
      <EditionAtmosphereMosaic seedKey={themesEditionMosaicSeedForTheme(themeId)} count={12} />
      <main className="ds-container ds-page" id="main">
        <div className={themesEditionStackClassName()}>
          <article className={themesEditionPanelClassName('intro')}>
            <header className="ds-themes-edition__header">
              <span className="ds-themes-edition__index" aria-hidden="true">
                00
              </span>
              <div>
                <p className="ds-themes-edition__kicker">
                  <Link href={`/themes/${themeId}`}>{entry.title}</Link> · Question {questionId}
                </p>
                <h1 className="ds-themes-edition__title">{packet.question}</h1>
                <p className="ds-themes-edition__lede">{packet.observationsSummary}</p>
              </div>
            </header>
          </article>

          {shouldShowThemeImpactStorytelling(questionId) ? (
            <article
              className={themesEditionPanelClassName('storytelling')}
              aria-labelledby={`question-storytelling-${questionId}`}
            >
              <p className="ds-themes-edition__panel-title">Storytelling</p>
              <ThemeImpactStorytellingPanel
                packet={packet}
                headingId={`question-storytelling-${questionId}`}
              />
            </article>
          ) : null}

          <article className={themesEditionPanelClassName('packet')}>
            <p className="ds-themes-edition__panel-title">Packet</p>
            <ThemeImpactPacketCard packet={packet} />
          </article>

          <p className="ds-themes-edition__footer">
            <Link href={`/themes/${themeId}`}>{entry.title} theme</Link>
            {' · '}
            <Link href="/themes">All themes</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
