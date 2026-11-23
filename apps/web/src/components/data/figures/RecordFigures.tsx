/**
 * The figures a record page shows: any registry figure whose rows cover the record's county or
 * state, at most two, each labeled with its real scope (docs/ui/DESIGN.md sections 9.1 and 9.5).
 * The rule is `figuresForRecord`; this component only loads what the rule needs and renders the
 * embeds. It comes after the record's own claims and map, never before them, and renders nothing
 * for a record no figure covers.
 */
import React, { cache } from 'react';
import { RecordBeat } from '../../patterns/RecordPage';
import { FigureEmbed } from './FigureEmbed';
import { createReleaseScopedCache } from '../../../lib/public-data/release-scoped-cache';
import { getPublicActiveReleaseMeta } from '../../../lib/public-data/source';
import { figuresForRecord, type RecordForFigures } from './figure-coverage';
import { FIGURES, FIGURE_IDS, isFigureId, type FigureFacts } from './registry';

void React;

/**
 * Every figure's coverage, in registry order. Nothing is drawn. Every record page asks for this,
 * so it is kept across requests for the life of the release, as the snapshots it reads are.
 */
const factsCache = createReleaseScopedCache<readonly FigureFacts[]>({
  kind: 'record-figure-facts',
});
const loadFigureFacts = cache(async (): Promise<readonly FigureFacts[]> => {
  const load = () => Promise.all(FIGURE_IDS.map((id) => FIGURES[id].facts()));
  const release = await getPublicActiveReleaseMeta();
  return (release ? await factsCache.get(release, load) : undefined) ?? load();
});

export async function RecordFigures({ record }: { readonly record: RecordForFigures }) {
  const picks = figuresForRecord(record, await loadFigureFacts());
  if (picks.length === 0) return null;
  return (
    <RecordBeat id="figures" title="Figures for context">
      {picks.map((pick) =>
        isFigureId(pick.id) ? (
          <FigureEmbed
            key={pick.id}
            id={pick.id}
            scope={pick.scope}
            quiet={pick.quiet}
            {...(pick.focus ? { focus: pick.focus } : {})}
          />
        ) : null,
      )}
    </RecordBeat>
  );
}
