'use client';

/**
 * A story's sections, with the reader's place in them.
 *
 *  - Wide screens: a sticky spine beside the column. One row per h2, the section's year (when the
 *    heading leads with one) in mono over its title; the current section carries aria-current
 *    and a copper mark, sections already read are ink, the rest muted.
 *  - Narrower: a sticky bar naming the current section, with a Contents button that opens the
 *    same list as a sheet (a native popover, so it opens with JavaScript off too).
 *
 * Both are in the document; story.css shows one per viewport with display:none, so assistive
 * technology never meets both. Both read the same headings, so they cannot disagree on a target.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useFocusTrap } from '../../lib/keyboard/use-focus-trap';
import type { ChapterHeading } from '../../lib/stories/heading-anchors';
import { splitSectionHeading } from './story-text';

void React;

const SHEET_ID = 'story-contents';

/** A section counts as reached once its heading crosses this far down the viewport. */
const READ_LINE = 0.3;

function useCurrentSection(ids: readonly string[]): number {
  const [current, setCurrent] = useState(-1);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const line = window.innerHeight * READ_LINE;
      let index = -1;
      ids.forEach((id, i) => {
        const node = document.getElementById(id);
        if (node && node.getBoundingClientRect().top <= line) index = i;
      });
      setCurrent(index);
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [ids]);
  return current;
}

function SectionList({
  headings,
  current,
  onPick,
  sourcesHref,
}: {
  readonly headings: readonly ChapterHeading[];
  readonly current: number;
  readonly onPick?: () => void;
  readonly sourcesHref?: string;
}) {
  return (
    <ol className="ds-story-sections">
      {headings.map((heading, index) => {
        const { year, title } = splitSectionHeading(heading.text);
        const state = index === current ? 'current' : index < current ? 'read' : 'ahead';
        return (
          <li key={heading.id} className="ds-story-sections__item" data-state={state}>
            <a
              className="ds-story-sections__link"
              href={`#${heading.id}`}
              aria-current={index === current ? 'location' : undefined}
              onClick={onPick}
            >
              {year ? <span className="ds-story-sections__year">{year}</span> : null}
              <span className="ds-story-sections__title">{title}</span>
            </a>
          </li>
        );
      })}
      {sourcesHref ? (
        <li
          className="ds-story-sections__item ds-story-sections__item--sources"
          data-state={current === headings.length ? 'current' : 'ahead'}
        >
          <a
            className="ds-story-sections__link"
            href={sourcesHref}
            aria-current={current === headings.length ? 'location' : undefined}
            onClick={onPick}
          >
            <span className="ds-story-sections__title">Sources</span>
          </a>
        </li>
      ) : null}
    </ol>
  );
}

export type StorySpineProps = {
  readonly headings: readonly ChapterHeading[];
  /** Anchor of the sources list, listed last when the story has sources. */
  readonly sourcesHref?: string;
};

/**
 * The spine and the bar as siblings, so the story frame's grid can place each one. Renders
 * nothing for a story with no sections.
 */
export function StorySpine({ headings, sourcesHref }: StorySpineProps) {
  // The sources list is measured last, so the spine marks it once the reader reaches it.
  const [ids] = useState(() => [
    ...headings.map((heading) => heading.id),
    ...(sourcesHref ? [sourcesHref.replace(/^#/, '')] : []),
  ]);
  const current = useCurrentSection(ids);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  // The sheet covers the page, so it is modal while open: Tab stays in it and the page is inert.
  useFocusTrap(sheetRef, open, { overlayRef: sheetRef });
  useEffect(() => {
    if (!open) return;
    const sheet = sheetRef.current;
    sheet?.focus();
    // Widening past the bar's breakpoint hides the sheet without closing it; close it, or the
    // page stays inert behind nothing.
    const closeIfHidden = () => {
      if (sheet && sheet.getClientRects().length === 0) sheet.hidePopover();
    };
    window.addEventListener('resize', closeIfHidden);
    return () => {
      window.removeEventListener('resize', closeIfHidden);
      // Runs after the trap's cleanup has made the button focusable again.
      openerRef.current?.focus();
    };
  }, [open]);
  if (headings.length === 0) return null;
  const here =
    current === headings.length
      ? { title: 'Sources' }
      : current >= 0
        ? splitSectionHeading(headings[current]!.text)
        : undefined;
  const close = () => {
    const sheet = document.getElementById(SHEET_ID);
    // A link inside a popover does not close it; the sheet should not cover where it jumped.
    if (sheet && 'hidePopover' in sheet) (sheet as HTMLElement).hidePopover();
  };
  return (
    <>
      <nav className="ds-story-spine" aria-label="Sections">
        <p className="ds-story-spine__label">Contents</p>
        <SectionList
          headings={headings}
          current={current}
          {...(sourcesHref ? { sourcesHref } : {})}
        />
      </nav>
      <div className="ds-story-bar">
        <p className="ds-story-bar__here" aria-live="off">
          {here ? (
            <>
              {'year' in here && here.year ? (
                <span className="ds-story-bar__year">{here.year}</span>
              ) : null}
              <span className="ds-story-bar__title">{here.title}</span>
            </>
          ) : (
            <span className="ds-story-bar__title">
              {headings.length} {headings.length === 1 ? 'section' : 'sections'}
            </span>
          )}
        </p>
        <button
          className="ds-story-bar__open"
          type="button"
          popoverTarget={SHEET_ID}
          ref={openerRef}
        >
          Contents
        </button>
        <div
          className="ds-story-sheet"
          data-ground="paper"
          id={SHEET_ID}
          popover="auto"
          role="dialog"
          aria-modal={open || undefined}
          aria-labelledby={`${SHEET_ID}-title`}
          tabIndex={-1}
          ref={sheetRef}
          onToggle={(event) => setOpen(event.newState === 'open')}
        >
          <div className="ds-story-sheet__head">
            <p className="ds-story-sheet__title" id={`${SHEET_ID}-title`}>
              Contents
            </p>
            <button
              className="ds-story-sheet__close"
              type="button"
              popoverTarget={SHEET_ID}
              popoverTargetAction="hide"
            >
              Close
            </button>
          </div>
          <SectionList
            headings={headings}
            current={current}
            onPick={close}
            {...(sourcesHref ? { sourcesHref } : {})}
          />
        </div>
      </div>
    </>
  );
}
