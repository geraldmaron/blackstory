/**
 * Theme-impact detail page at `/themes/[themeId]`. v6 edition Surface stack with shared
 * gutter mosaic, live packets, and fixture fallback.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EditionAtmosphereMosaic } from '../../../components/patterns/edition-atmosphere/EditionAtmosphereMosaic';
import { ThemeImpactMapStrip } from '../../../components/theme-impact/ThemeImpactMapStrip';
import { ThemeImpactPacketCard } from '../../../components/theme-impact/ThemeImpactPacketCard';
import { ThemeImpactStoryEmbed } from '../../../components/theme-impact/ThemeImpactStoryEmbed';
import { ThemeImpactStorytellingPanel } from '../../../components/theme-impact/ThemeImpactStorytellingPanel';
import {
  getThemeCatalogEntry,
  listAvailableThemeIds,
} from '../../../components/theme-impact/fixtures';
import { shouldShowThemeImpactStorytelling } from '../../../lib/theme-impact/storytelling-series';
import { listThemeImpactPacketViews, resolveRedliningPilotPacketView } from '../../../lib/theme-impact/source';
import {
  themesEditionMosaicSeedForTheme,
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

  const { packets, source } = await listThemeImpactPacketViews(themeId);
  const pilotPacket =
    themeId === 'redlining' ? await resolveRedliningPilotPacketView() : undefined;
  const storytellingPackets = packets.filter((packet) =>
    shouldShowThemeImpactStorytelling(packet.questionId),
  );
  const packetCountLabel = `${packets.length} question${packets.length === 1 ? '' : 's'} in scope`;

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
              Juxtaposition, not causation
            </h2>
            <p className="ds-themes-edition__method-body">
              Each packet below states its method stance and any gap labels. Policy timing beside an
              indicator is not proof of cause. See{' '}
              <Link href="/methodology">methodology</Link> for the full juxtaposition bar.
            </p>
            {source !== 'fixture' ? (
              <p className="ds-mono ds-themes-edition__live-badge">
                Data source: {source === 'live' ? 'live warehouse' : 'live + fixture fallback'}
              </p>
            ) : null}
          </article>

          {storytellingPackets.map((packet) => (
            <article
              key={packet.questionId}
              className={themesEditionPanelClassName('storytelling')}
              aria-labelledby={`theme-storytelling-${packet.questionId}`}
            >
              <p className="ds-themes-edition__panel-title">
                Storytelling · Q{packet.questionId}
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
                  {storytellingPackets.length > 0 ? '02' : '01'}
                </span>
                <div>
                  <p className="ds-themes-edition__kicker">Pilot consumers</p>
                  <h2 className="ds-themes-edition__title" id="theme-consumers-heading">
                    Story embed and map strip
                  </h2>
                  <p className="ds-themes-edition__lede">
                    Both surfaces read the same Chicago redlining Q3 packet (indicators, citations,
                    and juxtaposition method note) from {pilotPacket.dataSource ?? 'fixture'} data.
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
                {themeId === 'redlining' && pilotPacket
                  ? storytellingPackets.length > 0
                    ? '03'
                    : '02'
                  : storytellingPackets.length > 0
                    ? '02'
                    : '01'}
              </span>
              <div>
                <p className="ds-themes-edition__kicker">Canonical questions</p>
                <h2 className="ds-themes-edition__title" id="theme-packets-heading">
                  {packetCountLabel}
                </h2>
                <p className="ds-themes-edition__lede">
                  Packets compose warehouse observations, derived measurements, artifacts, and
                  explicit gap labels. Open a question for the full provenance quartet.
                </p>
              </div>
            </header>

            <ul className="ds-theme-impact__packets" aria-label={`${entry.title} question packets`}>
              {packets.map((packet) => (
                <li key={packet.questionId}>
                  <ThemeImpactPacketCard packet={packet} />
                  <p className="ds-theme-impact__question-link">
                    <Link href={`/themes/${themeId}/questions/${packet.questionId}`}>
                      Open question {packet.questionId}
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
