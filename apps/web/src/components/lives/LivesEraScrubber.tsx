'use client';

/**
 * The Lives reader's instrument and its one decade control: the eras as one row of columns, each
 * drawing that era's published comparison (one mark per group on the measure's own scale, its
 * value printed beside it), and the row is the tablist that picks which era reads below. Arrow
 * keys, Home and End step through it. One era shows at a time; every era is in the server HTML,
 * so the page is complete for search and before hydration, and `#era-<id>` deep links open it.
 *
 * Absence is said, never drawn: a group with no figure in an era prints "Not published" (or the
 * cell's own reason word) under the plot, and an era with no comparison at all is hatched and
 * labeled. Groups differ in mark shape as well as tone (filled dot, ring, square), and each group
 * is named in words beside its first value, so there is no legend. Below 30rem the columns turn
 * into rows on a horizontal scale.
 */
import React, { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

void React;

export type ScrubberMark = {
  readonly lens: 'black' | 'white' | 'hispanic';
  readonly label: string;
  /** Position on the measure's scale, 0 to 100, or null when this group was not published. */
  readonly at: number | null;
  readonly text: string;
};

export type ScrubberEra = {
  readonly id: string;
  readonly label: string;
  readonly marks: readonly ScrubberMark[] | null;
};

/** Value labels beside the marks, pushed apart where two values sit close, top to bottom. */
function valueLabels(
  marks: readonly ScrubberMark[],
): readonly (ScrubberMark & { readonly y: number })[] {
  const placed: (ScrubberMark & { y: number })[] = [];
  const sorted = marks
    .filter((mark): mark is ScrubberMark & { at: number } => mark.at !== null)
    .sort((a, b) => b.at - a.at);
  for (const mark of sorted) {
    const previous = placed.at(-1);
    const y = previous && previous.y - mark.at < 16 ? previous.y - 16 : mark.at;
    placed.push({ ...mark, y });
  }
  return placed;
}

export function LivesEraScrubber({
  measure,
  scaleNote,
  eras,
  panels,
}: {
  /** The measure the columns plot ("Owning their home"), or null when no era has one. */
  readonly measure: string | null;
  readonly scaleNote: string | null;
  readonly eras: readonly ScrubberEra[];
  /** One rendered era body per era, in the same order. */
  readonly panels: readonly ReactNode[];
}) {
  const [selected, setSelected] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  // A deep link to one era opens it.
  useEffect(() => {
    const open = () => {
      const hash = window.location.hash.replace(/^#era-/, '');
      const index = eras.findIndex((era) => era.id === hash);
      if (index > -1) setSelected(index);
    };
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, [eras]);

  function choose(index: number, focus: boolean) {
    const clamped = Math.min(eras.length - 1, Math.max(0, index));
    setSelected(clamped);
    const era = eras[clamped];
    if (era) window.history.replaceState(window.history.state, '', `#era-${era.id}`);
    if (focus) tabs.current[clamped]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const moves: Record<string, number> = {
      ArrowRight: selected + 1,
      ArrowDown: selected + 1,
      ArrowLeft: selected - 1,
      ArrowUp: selected - 1,
      Home: 0,
      End: eras.length - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    choose(next, true);
  }

  // Each group is named once, beside its first published value.
  const firstSeen = new Map<string, number>();
  eras.forEach((era, index) =>
    era.marks?.forEach((mark) => {
      if (mark.at !== null && !firstSeen.has(mark.lens)) firstSeen.set(mark.lens, index);
    }),
  );

  return (
    <section className="lives-eras" aria-label="Across the years">
      <div className="lives-scrub" data-ground="sand">
        {measure ? (
          <p className="lives-scrub__measure">
            <span className="lives-scrub__name">{measure}</span>
            {scaleNote ? <span className="lives-scrub__scale">{scaleNote}</span> : null}
          </p>
        ) : null}
        <div className="lives-scrub__row" role="tablist" aria-label="Era">
          {eras.map((era, index) => {
            const isSelected = index === selected;
            const [from, to] = era.label.split('–');
            const values = era.marks
              ? era.marks.map((mark) => `${mark.label} ${mark.text}`).join(', ')
              : 'not published';
            const missing = era.marks?.filter((mark) => mark.at === null) ?? [];
            const named = (mark: ScrubberMark) => firstSeen.get(mark.lens) === index;
            return (
              <button
                key={era.id}
                ref={(node) => {
                  tabs.current[index] = node;
                }}
                type="button"
                role="tab"
                id={`era-tab-${era.id}`}
                aria-selected={isSelected}
                aria-controls={`era-panel-${era.id}`}
                tabIndex={isSelected ? 0 : -1}
                className="lives-scrub__era"
                data-empty={era.marks ? undefined : 'true'}
                // The chosen era turns into an ink plate (shape and weight, not color alone), ink
                // in both themes: on the light table an unfixed ink ground is paper.
                data-ground={isSelected ? 'ink' : undefined}
                data-ground-fixed={isSelected ? '' : undefined}
                onClick={() => choose(index, false)}
                onKeyDown={onKeyDown}
              >
                {/* The tab's name is its own text, era first, so it matches what a voice-control
                    user reads off the tab; the plotted copies below are pictures of it. */}
                <span className="ds-visually-hidden">{`${era.label}: ${values}`}</span>
                <span className="lives-scrub__plot" aria-hidden="true">
                  {era.marks ? (
                    <>
                      {era.marks.map((mark) =>
                        mark.at === null ? null : (
                          <span
                            key={mark.lens}
                            className="lives-scrub__mark"
                            data-lens={mark.lens}
                            style={{ '--at': mark.at } as React.CSSProperties}
                          />
                        ),
                      )}
                      {valueLabels(era.marks).map((mark) => (
                        <span
                          key={mark.lens}
                          className="lives-scrub__value"
                          data-lens={mark.lens}
                          style={{ '--at': mark.y } as React.CSSProperties}
                        >
                          {named(mark) ? `${mark.label} ` : null}
                          {mark.text}
                        </span>
                      ))}
                    </>
                  ) : (
                    <span className="lives-scrub__none">Not published</span>
                  )}
                </span>
                {/* Row layout (phone): the same values as one line under the scale. */}
                <span className="lives-scrub__readout" aria-hidden="true">
                  {era.marks
                    ?.filter((mark) => mark.at !== null)
                    .map((mark) => (
                      <span key={mark.lens} className="lives-scrub__reading" data-lens={mark.lens}>
                        {named(mark) ? `${mark.label} ` : null}
                        {mark.text}
                      </span>
                    ))}
                </span>
                <span className="lives-scrub__missing" aria-hidden="true">
                  {missing.map((mark) => (
                    <span key={mark.lens}>
                      {mark.label} {mark.text.toLowerCase()}
                    </span>
                  ))}
                </span>
                <span className="lives-scrub__label" aria-hidden="true">
                  {from}
                  {to ? (
                    <>
                      <span className="lives-scrub__dash">–</span>
                      <wbr />
                      {to}
                    </>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {panels.map((panel, index) => {
        const era = eras[index]!;
        return (
          <div
            key={era.id}
            id={`era-panel-${era.id}`}
            role="tabpanel"
            aria-labelledby={`era-tab-${era.id}`}
            className="lives-eras__panel"
            hidden={index !== selected}
          >
            {panel}
          </div>
        );
      })}
    </section>
  );
}
