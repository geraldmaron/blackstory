/**
 * Theme-impact detail page at `/themes/[themeId]`. Continuous human arc first;
 * instruments beside; packet provenance secondary for hard readers.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChapterEssay } from '../../../components/theme-spine/ChapterEssay';
import '../../../components/theme-spine/theme-spine.css';
import { ThemeImpactArcReading } from '../../../components/theme-impact/ThemeImpactArcReading';
import { ThemeImpactMapStrip } from '../../../components/theme-impact/ThemeImpactMapStrip';
import { ThemeImpactPacketCard } from '../../../components/theme-impact/ThemeImpactPacketCard';
import { ThemeImpactStoryEmbed } from '../../../components/theme-impact/ThemeImpactStoryEmbed';
import { ThemeImpactStorytellingPanel } from '../../../components/theme-impact/ThemeImpactStorytellingPanel';
import { getThemeCatalogEntry, listCatalogThemeIds } from '../../../lib/theme-impact/catalog';
import { THEMES_PUBLIC_SURFACE_ENABLED } from '../../../lib/theme-impact/public-surface';
import { shouldShowThemeImpactStorytelling } from '../../../lib/theme-impact/storytelling-series';
import {
  listThemeImpactPacketViews,
  resolveChapterEntityExits,
  resolveRedliningPilotPacketView,
  resolveThemeSpine,
} from '../../../lib/theme-impact/source';
import {
  themesEditionPanelClassName,
  themesEditionRootClassName,
  themesEditionStackClassName,
} from '../themes-panel-chrome';
import '../themes-edition.css';
import '../../../components/theme-impact/theme-impact.css';

type ThemeDetailPageProps = {
  readonly params: Promise<{ readonly themeId: string }>;
};

export async function generateStaticParams() {
  if (!THEMES_PUBLIC_SURFACE_ENABLED) return [];
  return listCatalogThemeIds().map((themeId) => ({ themeId }));
}

export async function generateMetadata({ params }: ThemeDetailPageProps) {
  if (!THEMES_PUBLIC_SURFACE_ENABLED) {
    return { title: 'Theme not found' };
  }
  const { themeId } = await params;
  const entry = getThemeCatalogEntry(themeId);
  if (!entry) {
    return { title: 'Theme not found' };
  }
  return {
    title: entry.title,
    description: entry.lede,
  };
}

export default async function ThemeDetailPage({ params }: ThemeDetailPageProps) {
  if (!THEMES_PUBLIC_SURFACE_ENABLED) {
    notFound();
  }

  const { themeId } = await params;
  const entry = getThemeCatalogEntry(themeId);

  if (!entry) {
    notFound();
  }

  const { packets, source } = await listThemeImpactPacketViews(themeId);

  if (source === 'unavailable') {
    return (
      <div className={themesEditionRootClassName()} data-themes-edition="v6">
        <main className="ds-container ds-page" id="main">
          <div className={themesEditionStackClassName()}>
            <article className={themesEditionPanelClassName('intro')}>
              <header className="ds-themes-edition__header">
                <div>
                  <p className="ds-themes-edition__kicker">Theme · {entry.priority}</p>
                  <h1 className="ds-themes-edition__title">{entry.title}</h1>
                  <p className="ds-themes-edition__lede">
                    This theme is temporarily unavailable while we reconnect to the live record.
                    Nothing here is lost; please check back shortly.
                  </p>
                  <p className="ds-themes-edition__lede">
                    <Link href="/themes">Back to all themes</Link>
                  </p>
                </div>
              </header>
            </article>
          </div>
        </main>
      </div>
    );
  }

  if (packets.length === 0) {
    notFound();
  }

  const pilotPacket =
    themeId === 'redlining' ? await resolveRedliningPilotPacketView() : undefined;
  const storytellingPackets = packets.filter((packet) =>
    shouldShowThemeImpactStorytelling(packet.questionId),
  );
  const hasGatedCausal = packets.some((packet) => packet.methodStance === 'gated_causal_claim');
  const spine = await resolveThemeSpine(themeId);
  const hasChapters = spine.chapters.length > 0;
  const entityExitsByStoryId = hasChapters
    ? await resolveChapterEntityExits(spine.chapters)
    : new Map();

  return (
    <div className={themesEditionRootClassName()} data-themes-edition="v6">
      <main className="ds-container ds-page" id="main">
        <div className={themesEditionStackClassName()}>
          <article className={themesEditionPanelClassName('intro')}>
            <header className="ds-themes-edition__header">
              <span className="ds-themes-edition__index" aria-hidden="true">
                00
              </span>
              <div>
                <p className="ds-themes-edition__kicker">Theme · {entry.priority}</p>
                <h1 className="ds-themes-edition__title">{entry.title}</h1>
                <p className="ds-themes-edition__lede">{entry.lede}</p>
              </div>
            </header>
          </article>

          <article
            className={themesEditionPanelClassName('method')}
            aria-labelledby="theme-detail-method-heading"
          >
            <p className="ds-themes-edition__panel-title">Method</p>
            <h2 className="ds-themes-edition__method-title" id="theme-detail-method-heading">
              {hasGatedCausal
                ? 'Walk the journey; gate causation where secondaries require it'
                : 'Walk the journey; causation is not assumed'}
            </h2>
            <p className="ds-themes-edition__method-body">
              Each beat places you in a named scene before opening instruments. Co-movement is not
              proof of cause
              {hasGatedCausal
                ? ', unless a beat carries a gated causal claim with named secondary sources'
                : ''}
              . See <Link href="/methodology">methodology</Link> for confidence grades and when
              impact language is allowed.
            </p>
            <p className="ds-mono ds-themes-edition__live-badge">
              Data source: published release
            </p>
          </article>

          {hasChapters ? (
            <article
              className={themesEditionPanelClassName('chapter')}
              aria-labelledby="theme-chapter-heading"
              id="arc"
            >
              <header className="ds-themes-edition__header">
                <span className="ds-themes-edition__index" aria-hidden="true">
                  01
                </span>
                <div>
                  <p className="ds-themes-edition__kicker">Reading</p>
                  <h2 className="ds-themes-edition__title" id="theme-chapter-heading">
                    The journey
                  </h2>
                  <p className="ds-themes-edition__lede">
                    A continuous essay across bound chapters, with instruments folded in-flow.
                    Full packets remain in the instruments rail below for hard readers.
                  </p>
                </div>
              </header>
              <ChapterEssay
                themeTitle={entry.title}
                chapters={spine.chapters}
                entityExitsByStoryId={entityExitsByStoryId}
              />
            </article>
          ) : (
            <article
              className={themesEditionPanelClassName('arc')}
              aria-labelledby="theme-arc-heading"
              id="arc"
            >
              <header className="ds-themes-edition__header">
                <span className="ds-themes-edition__index" aria-hidden="true">
                  01
                </span>
                <div>
                  <p className="ds-themes-edition__kicker">Reading</p>
                  <h2 className="ds-themes-edition__title" id="theme-arc-heading">
                    The journey
                  </h2>
                  <p className="ds-themes-edition__lede">
                    Scene by scene through policy, practice, lived place, and measurement. Ink-sketch
                    visuals pace each beat; instruments sit beside the prose.
                  </p>
                </div>
              </header>
              <ThemeImpactArcReading
                themeId={themeId}
                packets={packets}
                headingId="theme-arc-reading"
              />
            </article>
          )}

          {storytellingPackets.map((packet) => (
            <article
              key={packet.questionId}
              className={themesEditionPanelClassName('storytelling')}
              aria-labelledby={`theme-storytelling-${packet.questionId}`}
            >
              <p className="ds-themes-edition__panel-title">
                Instrument detail · beat {packet.questionId}
              </p>
              <ThemeImpactStorytellingPanel
                packet={packet}
                headingId={`theme-storytelling-${packet.questionId}`}
              />
            </article>
          ))}

          {themeId === 'redlining' && pilotPacket ? (
            <article
              className={themesEditionPanelClassName('consumers')}
              aria-labelledby="theme-consumers-heading"
              id="consumers"
            >
              <header className="ds-themes-edition__header">
                <span className="ds-themes-edition__index" aria-hidden="true">
                  02
                </span>
                <div>
                  <p className="ds-themes-edition__kicker">Pilot consumers</p>
                  <h2 className="ds-themes-edition__title" id="theme-consumers-heading">
                    Story embed and map strip
                  </h2>
                  <p className="ds-themes-edition__lede">
                    Both surfaces read the same housing Q3 packet (indicators, citations, and
                    juxtaposition method note) from the published release.
                  </p>
                </div>
              </header>
              <div className="ds-theme-impact__consumers">
                <div className="ds-theme-impact__consumer-block">
                  <p className="ds-theme-impact__consumer-label">Story embed</p>
                  <ThemeImpactStoryEmbed headingId="redlining-story-embed" packet={pilotPacket} />
                </div>
                <div className="ds-theme-impact__consumer-block">
                  <p className="ds-theme-impact__consumer-label">Map context strip</p>
                  <ThemeImpactMapStrip labelId="redlining-map-strip" packet={pilotPacket} />
                </div>
              </div>
            </article>
          ) : null}

          <article
            className={themesEditionPanelClassName('packets')}
            aria-labelledby="theme-packets-heading"
            id="packets"
          >
            <header className="ds-themes-edition__header">
              <span className="ds-themes-edition__index" aria-hidden="true">
                {themeId === 'redlining' && pilotPacket ? '03' : '02'}
              </span>
              <div>
                <p className="ds-themes-edition__kicker">Verify</p>
                <h2 className="ds-themes-edition__title" id="theme-packets-heading">
                  Instruments and sources
                </h2>
                <p className="ds-themes-edition__lede">
                  Full packets for hard readers: observations, derived measurements, artifacts, and
                  provenance. Secondary to the arc above.
                </p>
              </div>
            </header>

            <ul className="ds-theme-impact__packets" aria-label={`${entry.title} source packets`}>
              {packets.map((packet) => (
                <li key={packet.questionId}>
                  <ThemeImpactPacketCard packet={packet} />
                  <p className="ds-theme-impact__question-link">
                    <Link href={`/themes/${themeId}/questions/${packet.questionId}`}>
                      Open beat {packet.questionId} sources
                    </Link>
                  </p>
                </li>
              ))}
            </ul>
          </article>

          <p className="ds-themes-edition__footer">
            <Link href="/themes">All themes</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
