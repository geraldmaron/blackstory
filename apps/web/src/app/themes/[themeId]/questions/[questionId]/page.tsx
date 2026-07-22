/**
 * Question-level theme-impact page at `/themes/[themeId]/questions/[questionId]`.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ThemeImpactPacketCard } from '../../../../components/theme-impact/ThemeImpactPacketCard';
import { ThemeImpactStorytellingPanel } from '../../../../components/theme-impact/ThemeImpactStorytellingPanel';
import { getThemeCatalogEntry } from '../../../../components/theme-impact/fixtures';
import { resolveThemeImpactPacketView } from '../../../../lib/theme-impact/source';
import { shouldShowThemeImpactStorytelling } from '../../../../lib/theme-impact/storytelling-series';
import '../../../../components/theme-impact/theme-impact.css';

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
    <main className="ds-container ds-page" id="main">
      <p className="ds-page__eyebrow">
        <Link href={`/themes/${themeId}`}>{entry.title}</Link> · Question {questionId}
      </p>
      <h1 className="ds-page__title">{packet.question}</h1>
      <p className="ds-page__lede">{packet.observationsSummary}</p>

      <div className="ds-theme-impact">
        {shouldShowThemeImpactStorytelling(questionId) ? (
          <ThemeImpactStorytellingPanel
            packet={packet}
            headingId={`question-storytelling-${questionId}`}
          />
        ) : null}

        <ThemeImpactPacketCard packet={packet} />

        <p className="ds-theme-impact__back">
          <Link href={`/themes/${themeId}`}>← {entry.title} theme</Link>
          {' · '}
          <Link href="/themes">All themes</Link>
        </p>
      </div>
    </main>
  );
}
