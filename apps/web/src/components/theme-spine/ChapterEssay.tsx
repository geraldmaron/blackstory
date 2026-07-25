'use client';

/**
 * Theme-spine chapter essay: renders a theme's bound chapters (see
 * `resolveThemeSpine` in `lib/theme-impact/source.ts`) as one continuous
 * voice-study artifact — eyebrow row, serif headline, italic dek, hairline,
 * then body sections with paragraphs and interleaved `DataMoment` /
 * `DisputeBlock` in document order. First paragraph of each chapter gets a
 * copper drop-cap (see theme-spine.css `::first-letter`).
 *
 * Optional engagement (both fully inert unless `prefers-reduced-motion:
 * no-preference`):
 *  - a single fade+4px-rise reveal per moment on first scroll into view
 *  - a 2px copper reading-progress hairline fixed at the top of the viewport
 * No parallax, no scroll-jacking.
 */
import React, { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../../lib/map-experience/camera-presets';

void React;
import type {
  ChapterEntityExit,
  HydratedThemeSpineDataMoment,
  HydratedThemeSpineMoment,
  ThemeSpineChapter,
  ThemeSpineDispute,
} from '../../lib/theme-impact/source';
import { DataMoment, type DataMomentMethodStance } from './DataMoment';
import { DisputeBlock } from './DisputeBlock';
import { EraTimeline } from './EraTimeline';
import { MapInsetMoment } from './MapInsetMoment';

export type ChapterEssayProps = {
  readonly themeTitle: string;
  readonly chapters: readonly ThemeSpineChapter[];
  /** Entity exit rail links (repo-cqey.8): "follow <entity> into <surface>" per chapter, keyed
   * by story id. Optional — chapters render fine with no exits (empty/omitted map). */
  readonly entityExitsByStoryId?: ReadonlyMap<string, readonly ChapterEntityExit[]>;
};

function toDataMomentMethodStance(
  methodStance: HydratedThemeSpineDataMoment['methodStance'],
): DataMomentMethodStance {
  return methodStance === 'gated_causal_claim' ? 'gated causal claim' : 'juxtaposition';
}

function SectionMoment({ moment }: { readonly moment: HydratedThemeSpineMoment }) {
  if (moment.kind === 'timeline') {
    return <EraTimeline events={moment.events} policyEras={moment.policyEras} />;
  }
  if (moment.kind === 'map') {
    return (
      <MapInsetMoment
        entityId={moment.entityId}
        label={moment.label}
        lat={moment.lat}
        lng={moment.lng}
        precision={moment.precision}
      />
    );
  }
  return (
    <DataMoment
      figure={moment.figure}
      claim={moment.claim}
      provenance={moment.provenance}
      methodStance={toDataMomentMethodStance(moment.methodStance)}
    />
  );
}

function DisputeArtifact({ dispute }: { readonly dispute: ThemeSpineDispute }) {
  return (
    <DisputeBlock
      label={dispute.label}
      sideA={dispute.sideA}
      sideB={dispute.sideB}
      standingLine="Both documents are in the archive. We show them side by side and let the contradiction stand."
    />
  );
}

/** Wraps a single moment so it can fade+rise into view once, gated on reduced motion. */
function RevealOnView({
  revealEnabled,
  children,
}: {
  readonly revealEnabled: boolean;
  readonly children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [revealed, setRevealed] = useState(!revealEnabled);

  useEffect(() => {
    if (!revealEnabled) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [revealEnabled]);

  return (
    <div
      ref={ref}
      className="ds-chapter-essay__reveal"
      data-revealed={revealed ? 'true' : 'false'}
    >
      {children}
    </div>
  );
}

/** Fixed 2px copper hairline tracking scroll progress through the essay container. */
function ReadingProgressHairline({
  containerRef,
  enabled,
}: {
  readonly containerRef: React.RefObject<HTMLElement | null>;
  readonly enabled: boolean;
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const node = containerRef.current;
    if (!node) return;

    function onScroll() {
      const rect = node!.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 1;
      const total = rect.height - viewportHeight;
      const scrolled = -rect.top;
      const ratio = total > 0 ? Math.min(Math.max(scrolled / total, 0), 1) : 0;
      setProgress(ratio);
    }

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [containerRef, enabled]);

  if (!enabled) return null;

  return (
    <div
      className="ds-chapter-essay__progress"
      aria-hidden="true"
      style={{ transform: `scaleX(${progress})` }}
    />
  );
}

export function ChapterEssay({ themeTitle, chapters, entityExitsByStoryId }: ChapterEssayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [motionEnabled, setMotionEnabled] = useState(false);

  useEffect(() => {
    setMotionEnabled(!prefersReducedMotion());
  }, []);

  return (
    <div className="ds-chapter-essay" ref={containerRef}>
      <ReadingProgressHairline containerRef={containerRef} enabled={motionEnabled} />
      {chapters.map((chapter, chapterOrdinal) => {
        const { story, sections } = chapter;
        const chapterIndex = story.themeBinding?.chapterIndex ?? chapterOrdinal + 1;
        const chapterCount = story.themeBinding?.chapterCount ?? chapters.length;
        const nextChapter = chapters[chapterOrdinal + 1];

        return (
          <section
            key={story.id}
            id={`chapter-${chapterIndex}`}
            className="ds-chapter-essay__chapter"
            aria-labelledby={`chapter-${story.id}-headline`}
          >
            <header className="ds-chapter-essay__eyebrow-row">
              <span className="ds-chapter-essay__eyebrow">{themeTitle}</span>
              <span className="ds-chapter-essay__eyebrow-sep" aria-hidden="true">
                ·
              </span>
              <span className="ds-chapter-essay__eyebrow">
                Chapter {chapterIndex} of {chapterCount}
              </span>
              <span className="ds-chapter-essay__eyebrow-sep" aria-hidden="true">
                ·
              </span>
              <span className="ds-chapter-essay__eyebrow">
                {story.eraLabel} · {story.placeLabel}
              </span>
            </header>

            <h2 className="ds-chapter-essay__headline" id={`chapter-${story.id}-headline`}>
              {story.title}
            </h2>
            <p className="ds-chapter-essay__dek">{story.dek}</p>
            <hr className="ds-chapter-essay__hairline" />

            <div className="ds-chapter-essay__body">
              {sections.map((section, sectionIndex) => (
                <div className="ds-chapter-essay__section" key={section.heading ?? sectionIndex}>
                  {section.heading ? (
                    <h3 className="ds-chapter-essay__section-heading">{section.heading}</h3>
                  ) : null}
                  {section.paragraphs.map((paragraph, paragraphIndex) => {
                    const isDropCap = chapterOrdinal === 0 && sectionIndex === 0 && paragraphIndex === 0;
                    return (
                      <p
                        key={paragraphIndex}
                        className={
                          isDropCap
                            ? 'ds-chapter-essay__paragraph ds-chapter-essay__paragraph--drop-cap'
                            : 'ds-chapter-essay__paragraph'
                        }
                      >
                        {paragraph}
                      </p>
                    );
                  })}

                  {section.moments.map((moment, momentIndex) => (
                    <RevealOnView revealEnabled={motionEnabled} key={momentIndex}>
                      <SectionMoment moment={moment} />
                    </RevealOnView>
                  ))}

                  {section.disputes.map((dispute, disputeIndex) => (
                    <DisputeArtifact dispute={dispute} key={disputeIndex} />
                  ))}
                </div>
              ))}
            </div>

            {(() => {
              const entityExits = entityExitsByStoryId?.get(story.id) ?? [];
              if (!nextChapter && entityExits.length === 0) return null;
              return (
                <footer className="ds-chapter-essay__close">
                  {nextChapter ? (
                    <a
                      className="ds-chapter-essay__close-link"
                      href={`#chapter-${nextChapter.story.id}-headline`}
                    >
                      Next — Chapter {chapterIndex + 1}: {nextChapter.story.title}
                    </a>
                  ) : null}
                  {entityExits.length > 0 ? (
                    <ul className="ds-chapter-essay__entity-exits">
                      {entityExits.map((exit) => (
                        <li key={exit.entityId}>
                          <a className="ds-chapter-essay__close-link" href={exit.href}>
                            Follow {exit.entityLabel} into {exit.targetLabel}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </footer>
              );
            })()}
          </section>
        );
      })}
    </div>
  );
}
