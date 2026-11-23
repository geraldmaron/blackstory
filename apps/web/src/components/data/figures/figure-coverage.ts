/**
 * Which figures a record page may show, and the words that say what each one covers
 * (docs/ui/DESIGN.md section 9.5, control f). No data access and no drawing: the rule is tested on
 * its own.
 *
 * A figure covers a record only where its rows do:
 *  - a county series, when the record sits in that county;
 *  - a state series, when the record's state is one of the figure's rows;
 *  - a national series, only on a record whose own jurisdiction is the whole country (a federal
 *    law) and whose subject the figure is about. A national series covers every record equally,
 *    so on a place it would say nothing about the place.
 *
 * A figure is about a record's subject when the record is one of the statutes curated for the
 * figure's theme (`theme-impact-linked-statutes.ts`). A quiet record (harm-adjacent) gets only
 * such a figure, in the quiet frame. At most two figures, in this order: about the subject first,
 * then the narrowest geography (county, one state, a comparison of states, the country), then
 * registry order.
 */
import { US_STATES } from '@repo/domain/map/geography';
import { listThemeImpactLinkedStatutes } from '@repo/domain/statistics';
import type { FigureCoverage, FigureFacts } from './figure-spec';

export const RECORD_FIGURE_LIMIT = 2;

const STATE_NAMES = new Set(US_STATES.map((state) => state.name));

/**
 * A series' own geography label as coverage. "United States (federal)" is the country, a state's
 * name is that state, "Cook County, Illinois" is that county. Anything else ("Suburban Cook
 * County, Illinois") is a place no record can be matched to, so it covers none.
 */
export function coverageFromGeography(label: string): FigureCoverage | undefined {
  const text = label.trim();
  if (/^United States\b/.test(text)) return { level: 'nation' };
  if (STATE_NAMES.has(text)) return { level: 'state', states: [text] };
  const [county, state, ...rest] = text.split(',').map((part) => part.trim());
  if (county && state && rest.length === 0 && STATE_NAMES.has(state)) {
    return { level: 'county', county, state };
  }
  return undefined;
}

export type RecordForFigures = {
  readonly id: string;
  /** Full state name, when the record has one state. */
  readonly state?: string;
  /** County name with its suffix ("Cook County"), when the record's point falls in one. */
  readonly county?: string;
  /** The record's own jurisdiction is the whole country (a federal law). */
  readonly nationwide?: boolean;
  /** Harm-adjacent: only a figure about the record's subject, in the quiet frame. */
  readonly quiet?: boolean;
};

export type FigureScope = {
  /** "Statewide context: Georgia". Printed in the exhibit's label and as the embed's first words. */
  readonly label: string;
  /** What the figure does and does not describe, one sentence. */
  readonly note: string;
};

export type RecordFigure = {
  readonly id: string;
  readonly scope: FigureScope;
  /** The record's state, to mark in a figure that compares states. */
  readonly focus?: string;
  readonly quiet: boolean;
};

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** A figure's geography in words, for an embed that is not on a record (a story). */
export function seriesScope(coverage: FigureCoverage): FigureScope {
  switch (coverage.level) {
    case 'nation':
      return {
        label: 'National series',
        note: 'This figure describes the United States as a whole.',
      };
    case 'county':
      return {
        label: `County series: ${coverage.county}, ${coverage.state}`,
        note: 'This figure describes one county, not the country.',
      };
    case 'state':
      return coverage.states.length === 1
        ? {
            label: `State series: ${coverage.states[0]}`,
            note: 'This figure describes one state, not the country.',
          }
        : {
            label: 'State-by-state series',
            note: `This figure compares ${coverage.states.length} states and territories; the rest are not in it.`,
          };
  }
}

/** The scope of a figure on a record it covers. `undefined` when it does not cover the record. */
export function recordScope(
  coverage: FigureCoverage,
  record: RecordForFigures,
): FigureScope | undefined {
  switch (coverage.level) {
    case 'county':
      return record.county &&
        record.state &&
        same(coverage.county, record.county) &&
        same(coverage.state, record.state)
        ? {
            label: `County context: ${coverage.county}, ${coverage.state}`,
            note: 'This figure describes the county as a whole, not this record.',
          }
        : undefined;
    case 'state': {
      const state = record.state;
      if (!state || !coverage.states.some((name) => same(name, state))) return undefined;
      return {
        label: `Statewide context: ${state}`,
        note:
          coverage.states.length === 1
            ? 'This figure describes the state as a whole, not this record.'
            : `This figure compares ${coverage.states.length} states and territories. It describes ${state} as a whole, not this record.`,
      };
    }
    case 'nation':
      return record.nationwide
        ? {
            label: 'National series',
            note: 'This figure describes the United States as a whole, not this record.',
          }
        : undefined;
  }
}

function aboutSubject(figure: FigureFacts, record: RecordForFigures): boolean {
  return (
    figure.themeId !== undefined &&
    listThemeImpactLinkedStatutes(figure.themeId).some((row) => row.entityId === record.id)
  );
}

const NARROWNESS = (coverage: FigureCoverage) =>
  coverage.level === 'county'
    ? 0
    : coverage.level === 'state'
      ? coverage.states.length === 1
        ? 1
        : 2
      : 3;

/** The figures a record page shows, at most two. `figures` is in registry order. */
export function figuresForRecord(
  record: RecordForFigures,
  figures: readonly FigureFacts[],
): readonly RecordFigure[] {
  const quiet = record.quiet === true;
  return figures
    .flatMap((figure, order) => {
      const coverage = figure.coverage;
      const scope = coverage ? recordScope(coverage, record) : undefined;
      if (!coverage || !scope) return [];
      const subject = aboutSubject(figure, record);
      // A national series needs the subject as well as the jurisdiction; a quiet record needs it
      // whatever the geography.
      if (!subject && (coverage.level === 'nation' || quiet)) return [];
      const compares = coverage.level === 'state' && coverage.states.length > 1;
      return [
        {
          rank: [subject ? 0 : 1, NARROWNESS(coverage), order] as const,
          pick: {
            id: figure.id,
            scope,
            ...(compares && record.state ? { focus: record.state } : {}),
            quiet,
          },
        },
      ];
    })
    .sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1] || a.rank[2] - b.rank[2])
    .slice(0, RECORD_FIGURE_LIMIT)
    .map((entry) => entry.pick);
}

/**
 * The receipt's date line. The data carries one identifier, the time its snapshot was built
 * (`built`, which some sources do not keep); no earlier build is kept, so a figure can say which build a story was written
 * against and whether the drawing is still that build, but it cannot redraw an old one.
 * `undefined` when the figure has no build date: none is invented.
 */
export function figureAsOf(
  built: string | undefined,
  writtenAsOf: string | undefined,
  formatDate: (iso: string) => string | undefined,
): { readonly text: string; readonly drifted: boolean } | undefined {
  const current = built ? formatDate(built) : undefined;
  const written = writtenAsOf ? formatDate(writtenAsOf) : undefined;
  if (!written) return current ? { text: `Figure as of ${current}.`, drifted: false } : undefined;
  if (!current) {
    return {
      text: `This story was written against the figure as of ${written}. Its source keeps no build date, so this page cannot say whether the data has changed since.`,
      drifted: false,
    };
  }
  if (built === writtenAsOf) {
    return {
      text: `Figure as of ${current}, the version this story was written against.`,
      drifted: false,
    };
  }
  return {
    text: `This story was written against the figure as of ${written}. The data was rebuilt ${current === written ? 'later that day' : `on ${current}`}, and this drawing is the current figure.`,
    drifted: true,
  };
}
